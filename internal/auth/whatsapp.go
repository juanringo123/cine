// Package auth menyediakan lookup nomor WhatsApp untuk alur login.
package auth

import (
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"cine/internal/db"
	"cine/internal/httpx"
)

// Handler melakukan pencarian user berdasarkan nomor telepon.
type Handler struct {
	db          *db.DB
	internalKey string
	log         *log.Logger
}

// NewHandler membuat handler lookup.
func NewHandler(database *db.DB, internalKey string, logger *log.Logger) *Handler {
	return &Handler{db: database, internalKey: internalKey, log: logger}
}

type lookupRequest struct {
	Phone string `json:"phone"`
}

// ServeHTTP mengembalikan email/user_id yang cocok dengan nomor.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.internalKey != "" {
		got := r.Header.Get("X-Internal-Key")
		if subtle.ConstantTimeCompare([]byte(got), []byte(h.internalKey)) != 1 {
			httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Akses lookup tidak diizinkan.")
			return
		}
	}
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body bukan JSON valid.")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if len(phone) < 8 || len(phone) > 20 {
		httpx.Error(w, http.StatusBadRequest, "invalid_phone", "Nomor telepon tidak valid.")
		return
	}

	result, err := h.db.FindUserByPhone(r.Context(), phone)
	if err != nil {
		h.log.Printf("find_user_by_phone: %v", err)
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mencari pengguna.")
		return
	}

	httpx.RawJSON(w, http.StatusOK, result)
}
