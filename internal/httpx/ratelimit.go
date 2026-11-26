package httpx

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateWindow struct {
	count int
	reset time.Time
}

// RateLimit membatasi jumlah request per IP dalam jendela waktu tertentu.
// Dipakai sebagai chi middleware: r.With(httpx.RateLimit(10, time.Minute)).
func RateLimit(limit int, per time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if limit <= 0 || per <= 0 {
			return next
		}

		var mu sync.Mutex
		windows := make(map[string]*rateWindow)
		lastSweep := time.Now()

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)

			mu.Lock()
			now := time.Now()
			if now.Sub(lastSweep) >= per || len(windows) > 1000 {
				for k, w := range windows {
					if now.After(w.reset) {
						delete(windows, k)
					}
				}
				lastSweep = now
			}
			win, ok := windows[ip]
			if !ok || now.After(win.reset) {
				win = &rateWindow{reset: now.Add(per)}
				windows[ip] = win
			}
			win.count++
			allowed := win.count <= limit
			remaining := limit - win.count
			if remaining < 0 {
				remaining = 0
			}
			mu.Unlock()

			w.Header().Set("X-RateLimit-Limit", itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", itoa(remaining))

			if !allowed {
				Error(w, http.StatusTooManyRequests, "rate_limited", "Terlalu banyak permintaan. Coba lagi nanti.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	parsed := net.ParseIP(strings.TrimSpace(host))
	if parsed != nil && (parsed.IsLoopback() || parsed.IsPrivate()) {
		if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
			first := strings.TrimSpace(strings.Split(xff, ",")[0])
			if net.ParseIP(first) != nil {
				return first
			}
		}
		if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
			if net.ParseIP(xri) != nil {
				return xri
			}
		}
	}
	return host
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
