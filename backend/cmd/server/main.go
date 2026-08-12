package main

import (
	"log"
	"net/http"
	"time"

	"jarin-wardrobe/internal/ai"
	"jarin-wardrobe/internal/apptime"
	"jarin-wardrobe/internal/config"
	cosclient "jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/handler"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/tagging"

	"github.com/gin-gonic/gin"

	_ "time/tzdata" // Windows 等环境无系统时区库时仍可加载 Asia/Shanghai
)

func main() {
	apptime.Init()
	cfg := config.Load()
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("[db] 初始化失败: %v", err)
	}
	defer db.Close()

	cosCli, err := cosclient.New(cfg)
	if err != nil {
		log.Fatalf("[cos] 初始化失败: %v", err)
	}
	if cosCli.Enabled() {
		log.Println("[cos] 腾讯云 COS 已启用")
	} else {
		log.Println("[cos] 未配置 COS，上传接口将不可用")
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware())
	r.MaxMultipartMemory = 12 << 20 // 12MB

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"ok":      true,
			"name":    "Jarin衣柜 API",
			"runtime": "go",
			"cos":     cosCli.Enabled(),
		})
	})

	aiClient := ai.NewClient(cfg)
	tagWorker := &tagging.Worker{Cfg: cfg, Client: aiClient, COS: cosCli}

	auth := handler.AuthHandler{Cfg: cfg}
	cats := handler.CategoriesHandler{}
	clothes := handler.ClothesHandler{Cfg: cfg, COS: cosCli, Tagger: tagWorker}
	outfits := handler.OutfitsHandler{Cfg: cfg, COS: cosCli}
	stats := handler.StatsHandler{}
	upload := handler.UploadHandler{Cfg: cfg, COS: cosCli}
	mediaH := handler.MediaHandler{Cfg: cfg, COS: cosCli}
	aiH := handler.AIHandler{Cfg: cfg, Client: aiClient, COS: cosCli}
	profileH := handler.ProfileHandler{}
	dietH := handler.DietHandler{Cfg: cfg, COS: cosCli}
	if cfg.AIEnabled() {
		log.Printf("[ai] 已启用 model=%s base=%s", cfg.AIModel, cfg.AIBaseURL)
	} else {
		log.Println("[ai] 未配置 AI_API_KEY，识别接口将不可用")
	}
	authMw := middleware.AuthRequired(cfg)
	mediaLimit := middleware.RateLimit(120, time.Minute)

	api := r.Group("/api")
	{
		api.POST("/auth/login", auth.Login)
		api.PUT("/auth/profile", authMw, auth.UpdateProfile)
		api.POST("/ai/clothing/analyze", authMw, aiH.AnalyzeClothing)
		api.POST("/ai/food/analyze", authMw, aiH.AnalyzeFood)

		api.GET("/profile/body", authMw, profileH.GetBody)
		api.PUT("/profile/body", authMw, profileH.UpsertBody)

		api.GET("/diet", authMw, dietH.List)
		api.GET("/diet/:id", authMw, dietH.Detail)
		api.POST("/diet", authMw, dietH.Create)
		api.PUT("/diet/:id", authMw, dietH.Update)
		api.DELETE("/diet/:id", authMw, dietH.Delete)

		// 图片走后端代理（签名校验 + IP 限流），不直接暴露 COS
		api.GET("/media/*key", mediaLimit, mediaH.Serve)

		api.GET("/categories", authMw, cats.List)
		api.POST("/categories", authMw, cats.Create)
		api.PUT("/categories/:id", authMw, cats.Update)
		api.DELETE("/categories/:id", authMw, cats.Delete)

		api.GET("/clothes", authMw, clothes.List)
		api.GET("/clothes/:id", authMw, clothes.Detail)
		api.POST("/clothes", authMw, clothes.Create)
		api.PUT("/clothes/:id", authMw, clothes.Update)
		api.POST("/clothes/:id/retag", authMw, clothes.Retag)
		api.DELETE("/clothes/:id", authMw, clothes.Delete)

		api.GET("/outfits", authMw, outfits.List)
		api.GET("/outfits/today", authMw, outfits.Today)
		api.GET("/outfits/:id", authMw, outfits.Detail)
		api.POST("/outfits", authMw, outfits.Create)
		api.DELETE("/outfits/:id", authMw, outfits.Delete)

		api.GET("/stats", authMw, stats.Get)
		api.GET("/tags", authMw, stats.Tags)

		api.POST("/upload", authMw, upload.Upload)
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
