package payment

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"cine/internal/db"
	"cine/internal/httpx"
)

// ChargeHandler membuat transaksi ke gateway (Midtrans Snap).
// Dipanggil server-to-server dari Next.js, bukan dari browser.
type ChargeHandler struct {
	db          *db.DB
	midtrans    Midtrans
	internalKey string
	log         *log.Logger
}

// NewChargeHandler membuat handler charge.
func NewChargeHandler(database *db.DB, midtrans Midtrans, internalKey string, logger *log.Logger) *ChargeHandler {
	return &ChargeHandler{db: database, midtrans: midtrans, internalKey: internalKey, log: logger}
}

type chargeRequest struct {
	PaymentID string `json:"payment_id"`
}

// ServeHTTP menyiapkan Snap URL untuk pembayaran pending.
func (h *ChargeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.internalKey == "" || r.Header.Get("X-Internal-Key") != h.internalKey {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Akses charge tidak diizinkan.")
		return
	}
	if r.Method != http.MethodPost {
		httpx.Error(w, http.StatusMethodNotAllowed, "method_not_allowed", "Gunakan POST.")
		return
	}

	var req chargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body bukan JSON valid.")
		return
	}
	req.PaymentID = strings.TrimSpace(req.PaymentID)
	if req.PaymentID == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_payment_id", "payment_id wajib diisi.")
		return
	}

	payment, err := h.db.PaymentByID(r.Context(), req.PaymentID)
	if err != nil {
		h.log.Printf("PaymentByID %s: %v", req.PaymentID, err)
		httpx.Error(w, http.StatusNotFound, "not_found", "Pembayaran tidak ditemukan.")
		return
	}
	if payment.Status != "pending" {
		httpx.Error(w, http.StatusConflict, "invalid_status", "Pembayaran tidak dalam status pending.")
		return
	}
	if payment.PaymentURL != nil && *payment.PaymentURL != "" {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"payment_id":   payment.ID,
			"redirect_url": *payment.PaymentURL,
			"reused":       true,
		})
		return
	}
	if payment.ExternalID == "" {
		httpx.Error(w, http.StatusInternalServerError, "missing_external_id", "external_id pembayaran kosong.")
		return
	}

	resp, err := h.midtrans.CreateSnap(r.Context(), payment.ExternalID, payment.Amount)
	if err != nil {
		h.log.Printf("CreateSnap %s: %v", req.PaymentID, err)
		httpx.Error(w, http.StatusBadGateway, "gateway_error", err.Error())
		return
	}

	redirectURL, _ := resp["redirect_url"].(string)
	token, _ := resp["token"].(string)
	if redirectURL == "" {
		httpx.Error(w, http.StatusBadGateway, "gateway_error", "Gateway tidak mengembalikan redirect_url.")
		return
	}

	raw, _ := json.Marshal(resp)
	if err := h.db.UpdatePaymentGateway(r.Context(), payment.ID, redirectURL, raw); err != nil {
		h.log.Printf("UpdatePaymentGateway %s: %v", payment.ID, err)
		httpx.Error(w, http.StatusInternalServerError, "db_error", "Gagal menyimpan URL pembayaran.")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"payment_id":   payment.ID,
		"order_id":     payment.ExternalID,
		"redirect_url": redirectURL,
		"token":        token,
		"gross_amount": payment.Amount,
		"reused":       false,
	})
}
