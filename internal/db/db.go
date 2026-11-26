// Package db membungkus koneksi pgx dan pemanggilan RPC Postgres.
// Semua fungsi RPC didefinisikan di migration 0002, 0006, dan 0007.
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB adalah koneksi pool ke Supabase Postgres.
type DB struct {
	pool *pgxpool.Pool
}

// New membuat pool dan memastikan koneksi hidup.
func New(ctx context.Context, url string, maxConns int32) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	if maxConns > 0 {
		cfg.MaxConns = maxConns
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("buat pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &DB{pool: pool}, nil
}

// Close menutup pool.
func (d *DB) Close() {
	if d.pool != nil {
		d.pool.Close()
	}
}

// call mengeksekusi satu RPC yang mengembalikan jsonb.
func (d *DB) call(ctx context.Context, sql string, args ...any) ([]byte, error) {
	var raw []byte
	if err := d.pool.QueryRow(ctx, sql, args...).Scan(&raw); err != nil {
		return nil, err
	}
	return raw, nil
}

// ConfirmPayment memanggil public.confirm_payment(p_payment_id uuid).
func (d *DB) ConfirmPayment(ctx context.Context, paymentID string) ([]byte, error) {
	return d.call(ctx, `select public.confirm_payment($1::uuid)`, paymentID)
}

// FailPayment memanggil public.fail_payment(p_payment_id uuid, p_reason text).
func (d *DB) FailPayment(ctx context.Context, paymentID, reason string) ([]byte, error) {
	return d.call(ctx, `select public.fail_payment($1::uuid, $2::text)`, paymentID, reason)
}

// FindUserByPhone memanggil public.find_user_by_phone(p_phone text).
func (d *DB) FindUserByPhone(ctx context.Context, phone string) ([]byte, error) {
	return d.call(ctx, `select public.find_user_by_phone($1::text)`, phone)
}

// FindPaymentByExternalID memanggil public.find_payment_by_external_id(text).
func (d *DB) FindPaymentByExternalID(ctx context.Context, externalID string) ([]byte, error) {
	return d.call(ctx, `select public.find_payment_by_external_id($1::text)`, externalID)
}

// GetTicketByCode memanggil public.get_ticket_by_code(text).
func (d *DB) GetTicketByCode(ctx context.Context, code string) ([]byte, error) {
	return d.call(ctx, `select public.get_ticket_by_code($1::text)`, code)
}

// GetOrderByCode memanggil public.get_order_by_code(text).
func (d *DB) GetOrderByCode(ctx context.Context, code string) ([]byte, error) {
	return d.call(ctx, `select public.get_order_by_code($1::text)`, code)
}

// VerifyTicketQR memanggil public.verify_ticket_qr(text, uuid).
func (d *DB) VerifyTicketQR(ctx context.Context, code, token string) ([]byte, error) {
	return d.call(ctx, `select public.verify_ticket_qr($1::text, $2::uuid)`, code, token)
}

// PaymentRow adalah data minimum yang dibutuhkan untuk charge ke gateway.
type PaymentRow struct {
	ID          string
	ExternalID  string
	Amount      int64
	Status      string
	PaymentURL  *string
	RawResponse []byte
}

// PaymentByID mengambil pembayaran berdasarkan id.
func (d *DB) PaymentByID(ctx context.Context, id string) (*PaymentRow, error) {
	var (
		row        PaymentRow
		extID      pgtype.Text
		statusText string
		raw        []byte
		payURL     pgtype.Text
	)
	err := d.pool.QueryRow(ctx, `
		select id, external_id, round(amount)::bigint, status::text, payment_url, coalesce(raw_response, '{}'::jsonb)
		from public.payments where id = $1::uuid
	`, id).Scan(&row.ID, &extID, &row.Amount, &statusText, &payURL, &raw)
	if err != nil {
		return nil, err
	}
	if extID.Valid {
		row.ExternalID = extID.String
	}
	if payURL.Valid {
		value := payURL.String
		row.PaymentURL = &value
	}
	row.Status = statusText
	row.RawResponse = raw
	return &row, nil
}

// NormalizePhone memanggil public.normalize_phone(text) yang mengembalikan text.
func (d *DB) NormalizePhone(ctx context.Context, phone string) (string, error) {
	var out pgtype.Text
	if err := d.pool.QueryRow(ctx,
		`select public.normalize_phone($1::text)`, phone,
	).Scan(&out); err != nil {
		return "", err
	}
	if !out.Valid {
		return "", nil
	}
	return out.String, nil
}

// CreateWhatsappOTP menyimpan hash OTP baru (kode lama otomatis nonaktif).
func (d *DB) CreateWhatsappOTP(
	ctx context.Context,
	phone, userID, codeHash string,
	ttlSeconds int,
) error {
	_, err := d.call(ctx, `select public.create_whatsapp_otp($1::text, $2::uuid, $3::text, $4::integer)`,
		phone, userID, codeHash, ttlSeconds)
	return err
}

// VerifyWhatsappOTP memanggil public.verify_whatsapp_otp(text, text).
func (d *DB) VerifyWhatsappOTP(ctx context.Context, phone, codeHash string) ([]byte, error) {
	return d.call(ctx, `select public.verify_whatsapp_otp($1::text, $2::text)`, phone, codeHash)
}

// UpdatePaymentGateway menyimpan hasil charge (redirect URL & response gateway).
func (d *DB) UpdatePaymentGateway(
	ctx context.Context,
	id string,
	paymentURL string,
	rawResponse []byte,
) error {
	_, err := d.pool.Exec(ctx, `
		update public.payments
		set payment_url = $2, raw_response = $3::jsonb, updated_at = now()
		where id = $1::uuid
	`, id, paymentURL, rawResponse)
	return err
}
