package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimit throttles requests per client IP using an in-memory token
// bucket — intended for auth endpoints (login/register) to blunt
// brute-force attempts. In-memory only, which is fine for a single backend
// instance at pilot scale; revisit if the backend ever runs multiple
// replicas behind a load balancer.
func RateLimit(requestsPerMinute, burst int) gin.HandlerFunc {
	var mu sync.Mutex
	limiters := make(map[string]*rate.Limiter)

	getLimiter := func(key string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()
		limiter, ok := limiters[key]
		if !ok {
			limiter = rate.NewLimiter(rate.Every(time.Minute/time.Duration(requestsPerMinute)), burst)
			limiters[key] = limiter
		}
		return limiter
	}

	return func(c *gin.Context) {
		if !getLimiter(c.ClientIP()).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": gin.H{
				"code": "RATE_LIMITED", "message": "too many requests, please try again later",
			}})
			return
		}
		c.Next()
	}
}
