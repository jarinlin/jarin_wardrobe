package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	Cfg config.Config
	COS *cos.Client
}

func (h UploadHandler) Upload(c *gin.Context) {
	if h.COS == nil || !h.COS.Enabled() {
		response.Fail(c, "未配置腾讯云 COS", 1, http.StatusOK)
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, "请选择图片文件", 1, http.StatusOK)
		return
	}
	if file.Size <= 0 {
		response.Fail(c, "文件为空", 1, http.StatusOK)
		return
	}
	// 10MB
	if file.Size > 10*1024*1024 {
		response.Fail(c, "图片不能超过 10MB", 1, http.StatusOK)
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", "":
	default:
		response.Fail(c, "仅支持 jpg/png/webp/gif", 1, http.StatusOK)
		return
	}

	f, err := file.Open()
	if err != nil {
		response.Fail(c, "读取文件失败", 1, http.StatusOK)
		return
	}
	defer f.Close()

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	uid := middleware.UserID(c)
	_, key, err := h.COS.Upload(c.Request.Context(), uid, file.Filename, f, contentType)
	if err != nil {
		response.Fail(c, "上传失败: "+err.Error(), 1, http.StatusOK)
		return
	}

	// 对外只返回后端代理地址，不暴露 COS 直链
	response.OK(c, gin.H{
		"url": media.ProxyURL(h.Cfg, uid, key),
		"key": key,
	})
}
