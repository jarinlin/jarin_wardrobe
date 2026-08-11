package main

import (
	"log"
	"net/http"

	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/handler"
	"jarin-wardrobe/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("[db] 初始化失败: %v", err)
	}
	defer db.Close()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "name": "Jarin衣柜 API", "runtime": "go"})
	})

	auth := handler.AuthHandler{Cfg: cfg}
	cats := handler.CategoriesHandler{}
	clothes := handler.ClothesHandler{}
	outfits := handler.OutfitsHandler{}
	stats := handler.StatsHandler{}
	authMw := middleware.AuthRequired(cfg)

	api := r.Group("/api")
	{
		api.POST("/auth/login", auth.Login)

		api.GET("/categories", authMw, cats.List)
		api.POST("/categories", authMw, cats.Create)
		api.PUT("/categories/:id", authMw, cats.Update)
		api.DELETE("/categories/:id", authMw, cats.Delete)

		api.GET("/clothes", authMw, clothes.List)
		api.GET("/clothes/:id", authMw, clothes.Detail)
		api.POST("/clothes", authMw, clothes.Create)
		api.PUT("/clothes/:id", authMw, clothes.Update)
		api.DELETE("/clothes/:id", authMw, clothes.Delete)

		api.GET("/outfits", authMw, outfits.List)
		api.GET("/outfits/today", authMw, outfits.Today)
		api.GET("/outfits/:id", authMw, outfits.Detail)
		api.POST("/outfits", authMw, outfits.Create)
		api.DELETE("/outfits/:id", authMw, outfits.Delete)

		api.GET("/stats", authMw, stats.Get)
		api.GET("/tags", authMw, stats.Tags)
	}

	addr := "0.0.0.0:" + cfg.Port
	log.Printf("Jarin衣柜 Go API 已启动: http://%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-WX-SERVICE")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
