package payment

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestMidtransVerifyAndStatus(t *testing.T) {
	serverKey := "midtrans-server-key"
	wh := MidtransWebhook{
		OrderID:           "PAY-ABC123",
		StatusCode:        "200",
		TransactionStatus: "settlement",
		GrossAmount:       "50000",
	}
	sum := sha256.Sum256([]byte(wh.OrderID + wh.StatusCode + wh.GrossAmount + serverKey))
	wh.SignatureKey = hex.EncodeToString(sum[:])

	m := Midtrans{ServerKey: serverKey}
	if !m.VerifyWebhook(wh) {
		t.Fatal("signature Midtrans valid harus diterima")
	}
	if got := m.Status(wh); got != "paid" {
		t.Errorf("Status settlement = %q, ingin paid", got)
	}

	wh.SignatureKey = "salah"
	if m.VerifyWebhook(wh) {
		t.Fatal("signature salah harus ditolak")
	}

	wh.TransactionStatus = "expire"
	if got := m.Status(wh); got != "failed" {
		t.Errorf("Status expire = %q, ingin failed", got)
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "rahasia-webhook"
	body := []byte(`{"payment_id":"abc","status":"paid"}`)

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	valid := hex.EncodeToString(mac.Sum(nil))

	if !VerifySignature(secret, body, valid) {
		t.Fatal("signature hex harus diterima")
	}
	if !VerifySignature(secret, body, "sha256="+valid) {
		t.Fatal("signature dengan prefix sha256= harus diterima")
	}
	if VerifySignature(secret, body, valid[:len(valid)-2]) {
		t.Fatal("signature terpotong harus ditolak")
	}
	if VerifySignature("salah", body, valid) {
		t.Fatal("secret salah harus ditolak")
	}
}

func TestNormalizeStatus(t *testing.T) {
	cases := map[string]string{
		"paid":                "paid",
		"SETTLEMENT":          "paid",
		"capture":             "paid",
		"transaction_success": "paid",
		"failed":              "failed",
		"deny":                "failed",
		"EXPIRE":              "failed",
		"pending":             "ignored",
		"":                    "ignored",
	}
	for input, want := range cases {
		if got := NormalizeStatus(input); got != want {
			t.Errorf("NormalizeStatus(%q) = %q, ingin %q", input, got, want)
		}
	}
}
