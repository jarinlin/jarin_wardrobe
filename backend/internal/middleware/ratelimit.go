package middleware

import (
	"net/http"
	"sync"
	"time"

	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type visitor struct {
	count int
	reset time.Time
}

// RateLimit 简易按 IP 限流：每 window 最多 limit 次
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	hits := map[string]*visitor{}

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()
		mu.Lock()
		v, ok := hits[ip]
		if !ok || now.After(v.reset) {
			hits[ip] = &visitor{count: 1, reset: now.Add(window)}
			mu.Unlock()
			c.Next()
			return
		}
		if v.count >= limit {
			mu.Unlock()
			response.Fail(c, "请求过于频繁", 429, http.StatusTooManyRequests)
			c.Abort()
			return
		}
		v.count++
		mu.Unlock()
		c.Next()
	}
}
