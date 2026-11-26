// Package config memuat konfigurasi cine-api dari environment variable.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config adalah konfigurasi runtime server.
type Config struct {
	Port                   string
	DatabaseURL            string
	WebhookSecret          string
	WebhookSignatureHeader string
	WebhookProvider        string // generic | midtrans
	PaymentGateway         string // midtrans
	MidtransServerKey      string
	MidtransSandbox        bool
	InternalAPIKey         string

	// WhatsApp OTP
	OTPProvider        string // dev | twilio | meta
	OTPPepper          string
	OTPTTLSeconds      int
	TwilioSID          string
	TwilioToken        string
	TwilioFrom         string
	MetaAccessToken    string
	MetaPhoneNumberID  string
	SupabaseURL        string
	SupabaseServiceKey string // dipakai untuk Auth Admin generateLink
	TicketQRBaseURL    string
	QRSize             int
	RequestTimeout     time.Duration
	MaxBodyBytes       int64
	MaxDBConns         int32
}

// FromEnv memuat .env (jika ada), lalu membaca dan memvalidasi konfigurasi.
func FromEnv() (Config, error) {
	_ = godotenv.Load()

	c := Config{
		Port:                   env("PORT", "8080"),
		DatabaseURL:            strings.TrimSpace(os.Getenv("DATABASE_URL")),
		WebhookSecret:          strings.TrimSpace(os.Getenv("WEBHOOK_SECRET")),
		WebhookSignatureHeader: env("WEBHOOK_SIGNATURE_HEADER", "X-Signature"),
		WebhookProvider:        strings.ToLower(env("WEBHOOK_PROVIDER", "generic")),
		PaymentGateway:         strings.ToLower(env("PAYMENT_GATEWAY", "midtrans")),
		MidtransServerKey:      strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY")),
		MidtransSandbox:        strings.ToLower(env("MIDTRANS_IS_SANDBOX", "true")) == "true",
		InternalAPIKey:         strings.TrimSpace(os.Getenv("INTERNAL_API_KEY")),

		OTPProvider:        strings.ToLower(env("OTP_PROVIDER", "dev")),
		OTPPepper:          env("OTP_PEPPER", "cine-dev-pepper"),
		OTPTTLSeconds:      envInt("OTP_TTL_SECONDS", 300),
		TwilioSID:          strings.TrimSpace(os.Getenv("TWILIO_ACCOUNT_SID")),
		TwilioToken:        strings.TrimSpace(os.Getenv("TWILIO_AUTH_TOKEN")),
		TwilioFrom:         strings.TrimSpace(os.Getenv("TWILIO_WHATSAPP_FROM")),
		MetaAccessToken:    strings.TrimSpace(os.Getenv("META_ACCESS_TOKEN")),
		MetaPhoneNumberID:  strings.TrimSpace(os.Getenv("META_PHONE_NUMBER_ID")),
		SupabaseURL:        strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/"),
		SupabaseServiceKey: strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY")),

		TicketQRBaseURL: strings.TrimRight(strings.TrimSpace(os.Getenv("TICKET_QR_BASE_URL")), "/"),
		QRSize:          envInt("QR_SIZE", 512),
		RequestTimeout:  time.Duration(envInt("REQUEST_TIMEOUT_SECONDS", 10)) * time.Second,
		MaxBodyBytes:    int64(envInt("MAX_BODY_BYTES", 1<<20)), // 1 MiB
		MaxDBConns:      int32(envInt("MAX_DB_CONNS", 10)),
	}

	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL wajib diisi")
	}
	if c.QRSize < 128 || c.QRSize > 2048 {
		return c, fmt.Errorf("QR_SIZE harus antara 128 dan 2048")
	}
	if c.RequestTimeout <= 0 {
		return c, fmt.Errorf("REQUEST_TIMEOUT_SECONDS harus > 0")
	}
	if c.MaxDBConns <= 0 {
		return c, fmt.Errorf("MAX_DB_CONNS harus > 0")
	}
	if c.OTPProvider != "dev" && c.OTPProvider != "twilio" && c.OTPProvider != "meta" {
		return c, fmt.Errorf("OTP_PROVIDER harus dev, twilio, atau meta")
	}
	if c.OTPTTLSeconds < 30 {
		return c, fmt.Errorf("OTP_TTL_SECONDS minimal 30")
	}
	if c.PaymentGateway != "midtrans" {
		return c, fmt.Errorf("PAYMENT_GATEWAY harus midtrans")
	}

	return c, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
