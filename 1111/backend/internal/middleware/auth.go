package middleware

import (
	"net/http"
	"strings"

	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID int64  `json:"userId"`
	OpenID string `json:"openid"`
	jwt.RegisteredClaims
}

func AuthRequired(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		tokenStr := ""
		if strings.HasPrefix(header, "Bearer ") {
			tokenStr = strings.TrimSpace(header[7:])
		}
		if tokenStr == "" {
			response.Fail(c, "未登录", 401, http.StatusUnauthorized)
			c.Abort()
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			response.Fail(c, "登录已失效", 401, http.StatusUnauthorized)
			c.Abort()
			return
		}
		c.Set("userId", claims.UserID)
		c.Set("openid", claims.OpenID)
		c.Next()
	}
}

func UserID(c *gin.Context) int64 {
	v, _ := c.Get("userId")
	id, _ := v.(int64)
	return id
}
