package handler

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"

	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type MediaHandler struct {
	Cfg config.Config
	COS *cos.Client
}

// Serve GET /api/media/*key?u=&exp=&sig=
func (h MediaHandler) Serve(c *gin.Context) {
	if h.COS == nil || !h.COS.Enabled() {
		response.Fail(c, "未配置腾讯云 COS", 1, http.StatusOK)
		return
	}
	key := strings.TrimPrefix(c.Param("key"), "/")
	if key == "" {
		response.Fail(c, "缺少文件", 1, http.StatusBadRequest)
		return
	}
	uid, exp, ok := media.ParseUserExpSig(c.Query("u"), c.Query("exp"), c.Query("sig"))
	if !ok || !media.Verify(h.Cfg, uid, key, exp, c.Query("sig")) {
		response.Fail(c, "链接无效或已过期", 403, http.StatusForbidden)
		return
	}

	body, contentType, err := h.COS.GetObject(c.Request.Context(), key)
	if err != nil {
		response.Fail(c, "文件不存在", 404, http.StatusNotFound)
		return
	}
	defer body.Close()

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "private, max-age=3600")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, body)
}

// resolveImageForAI 把客户端传来的代理 URL/key 转成 AI 可拉的预签名 COS 地址（私有桶必须签名）
func resolveImageForAI(ctx context.Context, cfg config.Config, cosCli *cos.Client, raw string) string {
	raw = strings.TrimSpace(raw)
	key := media.ExtractKey(cfg, raw)
	if key != "" && cosCli != nil && cosCli.Enabled() {
		if u, err := cosCli.PresignedGetURL(ctx, key, 30*time.Minute); err == nil && u != "" {
			return u
		}
	}
	// 外链或签名失败时原样返回（微信临时头像等）
	return raw
}
