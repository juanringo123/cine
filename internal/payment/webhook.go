// Package payment menangani webhook gateway pembayaran dan charge.
package payment

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"cine/internal/db"
	"cine/internal/httpx"
)

// Handler menangani webhook pembayaran.
type Handler struct {
	db              *db.DB
	secret          string
	signatureHeader string
	provider        string // "generic" | "midtrans"
	midtrans        Midtrans
	log             *log.Logger
}

// NewHandler membuat handler webhook.
func NewHandler(
	database *db.DB,
	secret, signatureHeader, provider string,
	midtrans Midtrans,
	logger *log.Logger,
) *Handler {
	return &Handler{
		db:              database,
		secret:          secret,
		signatureHeader: signatureHeader,
		provider:        provider,
		midtrans:        midtrans,
		log:             logger,
	}
}

type webhookRequest struct {
	PaymentID         string `json:"payment_id"`
	ExternalID        string `json:"external_id"`
	Status            string `json:"status"`
	TransactionStatus string `json:"transaction_status"`
	Reason            string `json:"reason"`
}

// ServeHTTP memverifikasi signature sesuai provider lalu memanggil
// RPC confirm_payment / fail_payment.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "read_error", "Gagal membaca body webhook.")
		return
	}

	var paymentID, externalID, status, reason string

	if h.provider == "midtrans" {
		var wh MidtransWebhook
		if err := json.Unmarshal(raw, &wh); err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body webhook Midtrans tidak valid.")
			return
		}
		if !h.midtrans.VerifyWebhook(wh) {
			httpx.Error(w, http.StatusUnauthorized, "invalid_signature", "Signature Midtrans tidak valid.")
			return
		}
		externalID = strings.TrimSpace(wh.OrderID)
		status = h.midtrans.Status(wh)
		reason = "Midtrans: " + wh.TransactionStatus
	} else {
		if h.secret == "" {
			httpx.Error(w, http.StatusServiceUnavailable, "not_configured", "WEBHOOK_SECRET belum diatur.")
			return
		}
		if !VerifySignature(h.secret, raw, r.Header.Get(h.signatureHeader)) {
			httpx.Error(w, http.StatusUnauthorized, "invalid_signature", "Signature webhook tidak valid.")
			return
		}
		var req webhookRequest
		if err := json.Unmarshal(raw, &req); err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body webhook bukan JSON valid.")
			return
		}
		paymentID = strings.TrimSpace(req.PaymentID)
		externalID = strings.TrimSpace(req.ExternalID)
		status = NormalizeStatus(req.Status + " " + req.TransactionStatus)
		reason = strings.TrimSpace(req.Reason)
	}

	if paymentID == "" && externalID != "" {
		rawFound, err := h.db.FindPaymentByExternalID(r.Context(), externalID)
		if err != nil {
			h.log.Printf("lookup payment %s: %v", externalID, err)
			httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mencari pembayaran.")
			return
		}
		var found map[string]any
		if err := json.Unmarshal(rawFound, &found); err != nil {
			httpx.Error(w, http.StatusBadGateway, "rpc_error", "Response lookup tidak valid.")
			return
		}
		if ok, _ := found["found"].(bool); !ok {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"status": "ignored", "message": "Pembayaran tidak ditemukan.",
			})
			return
		}
		paymentID = asString(found["payment_id"])
	}
	if paymentID == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_payment_id", "payment_id atau order_id wajib diisi.")
		return
	}

	switch status {
	case "paid":
		out, err := h.db.ConfirmPayment(r.Context(), paymentID)
		if err != nil {
			h.log.Printf("confirm_payment %s: %v", paymentID, err)
			httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mengonfirmasi pembayaran.")
			return
		}
		httpx.RawJSON(w, http.StatusOK, out)

	case "failed":
		if reason == "" {
			reason = "Pembayaran gagal dari gateway."
		}
		out, err := h.db.FailPayment(r.Context(), paymentID, reason)
		if err != nil {
			h.log.Printf("fail_payment %s: %v", paymentID, err)
			httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mencatat kegagalan pembayaran.")
			return
		}
		httpx.RawJSON(w, http.StatusOK, out)

	default:
		httpx.JSON(w, http.StatusOK, map[string]any{
			"status": "ignored", "payment_status": status,
		})
	}
}

// VerifySignature membandingkan HMAC-SHA256 body dengan header (provider generic).
func VerifySignature(secret string, body []byte, header string) bool {
	if secret == "" || header == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	got := strings.ToLower(strings.TrimSpace(header))
	got = strings.TrimPrefix(got, "sha256=")
	got = strings.TrimPrefix(got, "sha256:")
	if len(got) != len(expected) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(expected)) == 1
}

// NormalizeStatus memetakan status gateway generik ke status internal.
func NormalizeStatus(s string) string {
	v := strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.Contains(v, "settlement"),
		strings.Contains(v, "capture"),
		strings.Contains(v, "paid"),
		strings.Contains(v, "success"):
		return "paid"
	case strings.Contains(v, "fail"),
		strings.Contains(v, "deny"),
		strings.Contains(v, "reject"),
		strings.Contains(v, "cancel"),
		strings.Contains(v, "expire"):
		return "failed"
	default:
		return "ignored"
	}
}

func asString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case fmt.Stringer:
		return x.String()
	default:
		return ""
	}
}
