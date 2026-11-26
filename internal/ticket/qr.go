// Package ticket menyajikan QR PNG untuk tiket bioskop dan pesanan F&B.
package ticket

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/skip2/go-qrcode"

	"cine/internal/db"
	"cine/internal/httpx"
)

// Handler menghasilkan QR code PNG dan memverifikasi tiket.
type Handler struct {
	db          *db.DB
	size        int
	qrBaseURL   string
	internalKey string
	log         *log.Logger
}

// NewHandler membuat handler QR.
func NewHandler(database *db.DB, size int, qrBaseURL, internalKey string, logger *log.Logger) *Handler {
	if size <= 0 {
		size = 512
	}
	return &Handler{
		db:          database,
		size:        size,
		qrBaseURL:   qrBaseURL,
		internalKey: internalKey,
		log:         logger,
	}
}

func (h *Handler) requireInternal(w http.ResponseWriter, r *http.Request) bool {
	if h.internalKey == "" {
		return true
	}
	got := r.Header.Get("X-Internal-Key")
	if subtle.ConstantTimeCompare([]byte(got), []byte(h.internalKey)) != 1 {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Akses endpoint internal tidak diizinkan.")
		return false
	}
	return true
}

// TicketQR melayani GET /tickets/{code}/qr.png
func (h *Handler) TicketQR(w http.ResponseWriter, r *http.Request) {
	if !h.requireInternal(w, r) {
		return
	}
	h.serve(w, r, "ticket", chi.URLParam(r, "code"))
}

// OrderQR melayani GET /orders/{code}/qr.png
func (h *Handler) OrderQR(w http.ResponseWriter, r *http.Request) {
	if !h.requireInternal(w, r) {
		return
	}
	h.serve(w, r, "fnb", chi.URLParam(r, "code"))
}

// Verify melayani POST /tickets/verify untuk petugas.
func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	if !h.requireInternal(w, r) {
		return
	}
	var req struct {
		Code  string `json:"code"`
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body bukan JSON valid.")
		return
	}
	if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Token) == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_fields", "code dan token wajib diisi.")
		return
	}

	raw, err := h.db.VerifyTicketQR(r.Context(),
		strings.ToUpper(strings.TrimSpace(req.Code)),
		strings.TrimSpace(req.Token),
	)
	if err != nil {
		h.log.Printf("verify_ticket_qr: %v", err)
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal memverifikasi tiket.")
		return
	}

	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Response verifikasi tidak valid.")
		return
	}

	status := http.StatusOK
	if valid, _ := result["valid"].(bool); !valid {
		status = http.StatusUnprocessableEntity
	}
	httpx.JSON(w, status, result)
}

func (h *Handler) serve(w http.ResponseWriter, r *http.Request, kind, code string) {
	code = strings.TrimSpace(code)
	if code == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_code", "Kode tiket wajib diisi.")
		return
	}

	var (
		raw []byte
		err error
	)
	if kind == "fnb" {
		raw, err = h.db.GetOrderByCode(r.Context(), code)
	} else {
		raw, err = h.db.GetTicketByCode(r.Context(), code)
	}
	if err != nil {
		h.log.Printf("get code %s: %v", code, err)
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mengambil data tiket.")
		return
	}

	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Response tiket tidak valid.")
		return
	}
	if found, _ := data["found"].(bool); !found {
		httpx.Error(w, http.StatusNotFound, "not_found", "Tiket tidak ditemukan.")
		return
	}

	token, _ := data["qr_token"].(string)
	realCode, _ := data["code"].(string)
	if realCode == "" {
		realCode = strings.ToUpper(code)
	}

	png, err := qrcode.Encode(h.qrPayload(kind, realCode, token), qrcode.Medium, h.size)
	if err != nil {
		h.log.Printf("qrcode.Encode: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "qr_error", "Gagal membuat QR code.")
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("X-Ticket-Code", realCode)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}

func (h *Handler) qrPayload(kind, code, token string) string {
	if h.qrBaseURL != "" {
		return fmt.Sprintf("%s/ticket/%s?t=%s", h.qrBaseURL, code, token)
	}
	return fmt.Sprintf("CINE:%s:%s:%s", strings.ToUpper(kind), code, token)
}
