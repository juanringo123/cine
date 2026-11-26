package payment

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Midtrans adalah client Snap + verifikasi webhook.
type Midtrans struct {
	ServerKey string
	Sandbox   bool
}

func (m Midtrans) baseURL() string {
	if m.Sandbox {
		return "https://app.sandbox.midtrans.com"
	}
	return "https://app.midtrans.com"
}

// CreateSnap membuat transaksi Snap. redirect_url bisa langsung dipakai browser.
func (m Midtrans) CreateSnap(ctx context.Context, orderID string, amount int64) (map[string]any, error) {
	if m.ServerKey == "" {
		return nil, fmt.Errorf("MIDTRANS_SERVER_KEY belum diisi")
	}

	body, err := json.Marshal(map[string]any{
		"transaction_details": map[string]any{
			"order_id":     orderID,
			"gross_amount": amount,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("encode snap request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		m.baseURL()+"/snap/v1/transactions",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("buat request snap: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.SetBasicAuth(m.ServerKey, "")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("panggil snap: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("baca response snap: %w", err)
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("decode response snap: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return out, fmt.Errorf("snap gagal (%d): %s", resp.StatusCode, string(raw))
	}
	return out, nil
}

// MidtransWebhook adalah field yang dikirim Midtrans ke notification URL.
type MidtransWebhook struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	TransactionStatus string `json:"transaction_status"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	FraudStatus       string `json:"fraud_status"`
}

// VerifyWebhook memverifikasi signature_key = sha256(order_id + status_code
// + gross_amount + server_key).
func (m Midtrans) VerifyWebhook(w MidtransWebhook) bool {
	if m.ServerKey == "" || w.SignatureKey == "" {
		return false
	}
	sum := sha256.Sum256([]byte(w.OrderID + w.StatusCode + w.GrossAmount + m.ServerKey))
	want := hex.EncodeToString(sum[:])
	got := strings.ToLower(strings.TrimSpace(w.SignatureKey))
	if len(got) != len(want) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

// Status memetakan transaction_status Midtrans ke status internal.
func (m Midtrans) Status(w MidtransWebhook) string {
	s := strings.ToLower(w.TransactionStatus)
	switch {
	case strings.Contains(s, "settlement"):
		return "paid"
	case strings.Contains(s, "capture"):
		if strings.EqualFold(w.FraudStatus, "challenge") {
			return "ignored"
		}
		return "paid"
	case strings.Contains(s, "deny"),
		strings.Contains(s, "expire"),
		strings.Contains(s, "cancel"),
		strings.Contains(s, "failed"):
		return "failed"
	default:
		return "ignored"
	}
}
