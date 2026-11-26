// Command server menjalankan HTTP API untuk CINÉ.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"cine/internal/auth"
	"cine/internal/config"
	"cine/internal/db"
	"cine/internal/httpx"
	"cine/internal/payment"
	"cine/internal/ticket"
)

func main() {
	logger := log.New(os.Stdout, "[cine-api] ", log.LstdFlags|log.LUTC)

	cfg, err := config.FromEnv()
	if err != nil {
		logger.Fatalf("konfigurasi invalid: %v", err)
	}

	ctx := context.Background()
	database, err := db.New(ctx, cfg.DatabaseURL, cfg.MaxDBConns)
	if err != nil {
		logger.Fatalf("database: %v", err)
	}
	defer database.Close()

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(cfg.RequestTimeout))
	r.Use(httpx.Logging)
	r.Use(httpx.MaxBytes(cfg.MaxBodyBytes))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"status": "ok"})
	})

	gateway := payment.Midtrans{
		ServerKey: cfg.MidtransServerKey,
		Sandbox:   cfg.MidtransSandbox,
	}

	r.Post("/webhooks/payment", payment.NewHandler(
		database,
		cfg.WebhookSecret,
		cfg.WebhookSignatureHeader,
		cfg.WebhookProvider,
		gateway,
		logger,
	).ServeHTTP)

	// Dipanggil dari Next.js server route (server-to-server).
	r.Post("/payments/charge", payment.NewChargeHandler(
		database, gateway, cfg.InternalAPIKey, logger,
	).ServeHTTP)

	// Batasi lookup nomor -> email supaya tidak dipakai untuk enumerasi.
	r.With(httpx.RateLimit(10, time.Minute)).Post(
		"/auth/whatsapp/lookup",
		auth.NewHandler(database, cfg.InternalAPIKey, logger).ServeHTTP,
	)

	otp := auth.NewOTPHandler(database, auth.OTPConfig{
		Provider:           cfg.OTPProvider,
		Pepper:             cfg.OTPPepper,
		TTL:                cfg.OTPTTLSeconds,
		TwilioSID:          cfg.TwilioSID,
		TwilioToken:        cfg.TwilioToken,
		TwilioFrom:         cfg.TwilioFrom,
		MetaAccessToken:    cfg.MetaAccessToken,
		MetaPhoneNumberID:  cfg.MetaPhoneNumberID,
		SupabaseURL:        cfg.SupabaseURL,
		SupabaseServiceKey: cfg.SupabaseServiceKey,
	}, logger)

	// Batasi permintaan OTP untuk mencegah spam SMS/WhatsApp.
	r.With(httpx.RateLimit(5, 10*time.Minute)).Post("/auth/whatsapp/request", otp.Request)
	r.With(httpx.RateLimit(10, 10*time.Minute)).Post("/auth/whatsapp/verify", otp.Verify)

	tickets := ticket.NewHandler(database, cfg.QRSize, cfg.TicketQRBaseURL, cfg.InternalAPIKey, logger)
	r.Get("/tickets/{code}/qr.png", tickets.TicketQR)
	r.Get("/orders/{code}/qr.png", tickets.OrderQR)
	r.Post("/tickets/verify", tickets.Verify)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      cfg.RequestTimeout + 5*time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Printf("listen on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("server error: %v", err)
		}
	}()

	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-stopCtx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Printf("shutdown: %v", err)
	}
	logger.Println("stopped")
}
