package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cine/internal/db"
	"cine/internal/httpx"
)

// OTPConfig berisi kredensial provider pengirim OTP.
type OTPConfig struct {
	Provider           string
	Pepper             string
	TTL                int
	TwilioSID          string
	TwilioToken        string
	TwilioFrom         string
	MetaAccessToken    string
	MetaPhoneNumberID  string
	SupabaseURL        string
	SupabaseServiceKey string
}

// OTPHandler menangani permintaan & verifikasi kode OTP WhatsApp.
type OTPHandler struct {
	db   *db.DB
	cfg  OTPConfig
	log  *log.Logger
	http *http.Client
}

// NewOTPHandler membuat handler OTP.
func NewOTPHandler(database *db.DB, cfg OTPConfig, logger *log.Logger) *OTPHandler {
	return &OTPHandler{
		db:   database,
		cfg:  cfg,
		log:  logger,
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

type otpRequest struct {
	Phone string `json:"phone"`
}
type otpVerifyRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// Request membuat kode OTP, menyimpannya, lalu mengirim via provider.
func (h *OTPHandler) Request(w http.ResponseWriter, r *http.Request) {
	var req otpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body bukan JSON valid.")
		return
	}

	phone, err := h.db.NormalizePhone(r.Context(), req.Phone)
	if err != nil || phone == "" {
		httpx.Error(w, http.StatusBadRequest, "invalid_phone", "Nomor telepon tidak valid.")
		return
	}

	raw, err := h.db.FindUserByPhone(r.Context(), phone)
	if err != nil {
		h.log.Printf("find_user_by_phone: %v", err)
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Gagal mencari pengguna.")
		return
	}
	var found map[string]any
	if err := json.Unmarshal(raw, &found); err != nil {
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Response lookup tidak valid.")
		return
	}
	if ok, _ := found["found"].(bool); !ok {
		httpx.Error(w, http.StatusNotFound, "not_found", "Nomor belum terdaftar. Daftar terlebih dahulu.")
		return
	}

	code, err := randomCode()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "otp_error", "Gagal membuat kode OTP.")
		return
	}
	hash := h.hash(phone, code)
	userID, _ := found["user_id"].(string)

	if err := h.db.CreateWhatsappOTP(r.Context(), phone, userID, hash, h.cfg.TTL); err != nil {
		h.log.Printf("create_whatsapp_otp: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "otp_error", "Gagal menyimpan OTP.")
		return
	}

	if err := h.deliver(r.Context(), phone, code); err != nil {
		h.log.Printf("deliver OTP via %s: %v", h.cfg.Provider, err)
		httpx.Error(w, http.StatusBadGateway, "delivery_error", err.Error())
		return
	}

	out := map[string]any{"sent": true, "to": maskPhone(phone)}
	if h.cfg.Provider == "dev" {
		out["dev_code"] = code
		out["note"] = "MODE DEV: kode tidak dikirim, tampil di response & log server."
	}
	httpx.JSON(w, http.StatusOK, out)
}

// Verify mencocokkan kode lalu menukarnya dengan token_hash sesi Supabase.
func (h *OTPHandler) Verify(w http.ResponseWriter, r *http.Request) {
	var req otpVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Body bukan JSON valid.")
		return
	}
	code := strings.TrimSpace(req.Code)
	if len(code) != 6 {
		httpx.Error(w, http.StatusBadRequest, "invalid_code", "Kode OTP harus 6 digit.")
		return
	}

	phone, err := h.db.NormalizePhone(r.Context(), req.Phone)
	if err != nil || phone == "" {
		httpx.Error(w, http.StatusBadRequest, "invalid_phone", "Nomor telepon tidak valid.")
		return
	}

	raw, err := h.db.VerifyWhatsappOTP(r.Context(), phone, h.hash(phone, code))
	if err != nil {
		h.log.Printf("verify_whatsapp_otp: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "rpc_error", "Gagal memverifikasi OTP.")
		return
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		httpx.Error(w, http.StatusBadGateway, "rpc_error", "Response verifikasi tidak valid.")
		return
	}
	if valid, _ := result["valid"].(bool); !valid {
		message, _ := result["message"].(string)
		if message == "" {
			message = "Kode OTP tidak valid."
		}
		httpx.Error(w, http.StatusUnauthorized, "invalid_otp", message)
		return
	}

	email, _ := result["email"].(string)
	tokenHash, err := h.generateMagicLinkToken(r.Context(), email)
	if err != nil {
		h.log.Printf("generateLink: %v", err)
		httpx.Error(w, http.StatusBadGateway, "auth_error", err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"verified":   true,
		"email":      email,
		"token_hash": tokenHash,
		"type":       "magiclink",
	})
}

func (h *OTPHandler) hash(phone, code string) string {
	sum := sha256.Sum256([]byte(h.cfg.Pepper + ":" + phone + ":" + code))
	return hex.EncodeToString(sum[:])
}

func (h *OTPHandler) deliver(ctx context.Context, phone, code string) error {
	body := fmt.Sprintf("Kode OTP CINÉ kamu: %s. Berlaku %d menit. Jangan bagikan ke siapa pun.", code, h.cfg.TTL/60)

	switch h.cfg.Provider {
	case "dev":
		h.log.Printf("OTP DEV untuk %s: %s", phone, code)
		return nil

	case "twilio":
		if h.cfg.TwilioSID == "" || h.cfg.TwilioToken == "" || h.cfg.TwilioFrom == "" {
			return fmt.Errorf("TWILIO_ACCOUNT_SID / AUTH_TOKEN / WHATSAPP_FROM belum diisi")
		}
		form := url.Values{}
		form.Set("To", "whatsapp:+"+phone)
		form.Set("From", h.cfg.TwilioFrom)
		form.Set("Body", body)

		endpoint := fmt.Sprintf(
			"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
			url.PathEscape(h.cfg.TwilioSID),
		)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetBasicAuth(h.cfg.TwilioSID, h.cfg.TwilioToken)
		resp, err := h.http.Do(req)
		if err != nil {
			return fmt.Errorf("kirim via Twilio: %w", err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("Twilio gagal (%d): %s", resp.StatusCode, string(raw))
		}
		return nil

	case "meta":
		if h.cfg.MetaAccessToken == "" || h.cfg.MetaPhoneNumberID == "" {
			return fmt.Errorf("META_ACCESS_TOKEN / META_PHONE_NUMBER_ID belum diisi")
		}
		payload, err := json.Marshal(map[string]any{
			"messaging_product": "whatsapp",
			"to":                phone,
			"type":              "text",
			"text":              map[string]any{"body": body},
		})
		if err != nil {
			return err
		}
		endpoint := fmt.Sprintf(
			"https://graph.facebook.com/v21.0/%s/messages",
			url.PathEscape(h.cfg.MetaPhoneNumberID),
		)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(payload)))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+h.cfg.MetaAccessToken)
		resp, err := h.http.Do(req)
		if err != nil {
			return fmt.Errorf("kirim via Meta: %w", err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("Meta gagal (%d): %s", resp.StatusCode, string(raw))
		}
		return nil

	default:
		return fmt.Errorf("OTP_PROVIDER %q tidak dikenal", h.cfg.Provider)
	}
}

// generateMagicLinkToken meminta Supabase Auth membuat token sekali pakai.
func (h *OTPHandler) generateMagicLinkToken(ctx context.Context, email string) (string, error) {
	if h.cfg.SupabaseURL == "" || h.cfg.SupabaseServiceKey == "" {
		return "", fmt.Errorf("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi")
	}
	if email == "" {
		return "", fmt.Errorf("email pengguna tidak ditemukan")
	}

	body, _ := json.Marshal(map[string]any{"type": "magiclink", "email": email})
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		h.cfg.SupabaseURL+"/auth/v1/admin/generate_link",
		strings.NewReader(string(body)),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", h.cfg.SupabaseServiceKey)
	req.Header.Set("Authorization", "Bearer "+h.cfg.SupabaseServiceKey)

	resp, err := h.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("panggil Auth Admin: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Auth Admin gagal (%d): %s", resp.StatusCode, string(raw))
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("decode Auth Admin: %w", err)
	}
	tokenHash, _ := out["hashed_token"].(string)
	if tokenHash == "" {
		return "", fmt.Errorf("Auth Admin tidak mengembalikan hashed_token")
	}
	return tokenHash, nil
}

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func maskPhone(phone string) string {
	if len(phone) <= 6 {
		return phone
	}
	return phone[:4] + "****" + phone[len(phone)-2:]
}
