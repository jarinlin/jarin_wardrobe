package media

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"jarin-wardrobe/internal/config"
)

const DefaultTTL = 7 * 24 * time.Hour

// PublicBase 对外 API 根地址（无尾斜杠）
func PublicBase(cfg config.Config) string {
	base := strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/")
	if base == "" {
		base = "http://127.0.0.1:" + cfg.Port
	}
	return base
}

// UserKeyPrefix 对象键用户前缀：prefix/userId/ 或 userId/（prefix 为空时）
func UserKeyPrefix(cfg config.Config, userID int64) string {
	prefix := strings.Trim(cfg.COSPrefix, "/")
	if prefix == "" {
		return fmt.Sprintf("%d/", userID)
	}
	return fmt.Sprintf("%s/%d/", prefix, userID)
}

func cosHosts(cfg config.Config) map[string]bool {
	hosts := map[string]bool{}
	if cfg.COSBucket != "" && cfg.COSRegion != "" {
		hosts[strings.ToLower(fmt.Sprintf("%s.cos.%s.myqcloud.com", cfg.COSBucket, cfg.COSRegion))] = true
	}
	if d := strings.TrimSpace(cfg.COSCDNDomain); d != "" {
		if !strings.Contains(d, "://") {
			d = "https://" + d
		}
		if u, err := url.Parse(d); err == nil && u.Host != "" {
			hosts[strings.ToLower(u.Host)] = true
		}
	}
	return hosts
}

// ExtractKey 从代理 URL / 本站 COS URL / 纯 key 中解析对象键；外链（如微信头像）返回空
func ExtractKey(cfg config.Config, raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// 去掉 query
	if i := strings.Index(raw, "?"); i >= 0 {
		raw = raw[:i]
	}
	raw = strings.TrimSpace(raw)

	// 代理路径：/api/media/wardrobe/1/...
	if idx := strings.Index(raw, "/api/media/"); idx >= 0 {
		key := raw[idx+len("/api/media/"):]
		key, _ = url.PathUnescape(key)
		return strings.TrimPrefix(key, "/")
	}

	// 仅本站 COS / CDN 域名下的 path 才当作 key，避免把微信头像等外链写成假 key
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil || u.Host == "" {
			return ""
		}
		if cosHosts(cfg)[strings.ToLower(u.Host)] {
			return strings.TrimPrefix(u.Path, "/")
		}
		return ""
	}

	return strings.TrimPrefix(raw, "/")
}

// OwnsKey 校验对象是否属于该用户（按上传路径约定 prefix/userId/...）
func OwnsKey(cfg config.Config, key string, userID int64) bool {
	key = strings.TrimPrefix(key, "/")
	if key == "" || userID <= 0 {
		return false
	}
	return strings.HasPrefix(key, UserKeyPrefix(cfg, userID))
}

func signPayload(userID int64, key string, exp int64) string {
	return fmt.Sprintf("%d\n%s\n%d", userID, key, exp)
}

func Sign(cfg config.Config, userID int64, key string, ttl time.Duration) (exp int64, sig string) {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	exp = time.Now().Add(ttl).Unix()
	mac := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	_, _ = mac.Write([]byte(signPayload(userID, key, exp)))
	sig = hex.EncodeToString(mac.Sum(nil))
	return exp, sig
}

func Verify(cfg config.Config, userID int64, key string, exp int64, sig string) bool {
	if key == "" || sig == "" || exp <= 0 {
		return false
	}
	if time.Now().Unix() > exp {
		return false
	}
	if !OwnsKey(cfg, key, userID) {
		return false
	}
	mac := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	_, _ = mac.Write([]byte(signPayload(userID, key, exp)))
	expect := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expect), []byte(sig))
}

// ProxyURL 生成可供 <image> 直接使用的后端媒体地址
func ProxyURL(cfg config.Config, userID int64, stored string) string {
	stored = strings.TrimSpace(stored)
	if stored == "" {
		return ""
	}
	key := ExtractKey(cfg, stored)
	// 非本站 COS key（如微信头像临时链）原样返回
	if key == "" || !OwnsKey(cfg, key, userID) {
		if strings.HasPrefix(stored, "http://") || strings.HasPrefix(stored, "https://") {
			return stored
		}
		return ""
	}
	exp, sig := Sign(cfg, userID, key, DefaultTTL)
	escaped := escapeKeyPath(key)
	return fmt.Sprintf("%s/api/media/%s?u=%d&exp=%d&sig=%s",
		PublicBase(cfg), escaped, userID, exp, sig)
}

func escapeKeyPath(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

// NormalizeForStore 入库前统一存 COS key
func NormalizeForStore(cfg config.Config, raw string) string {
	return ExtractKey(cfg, raw)
}

// ParseUserExpSig 解析媒体查询参数
func ParseUserExpSig(u, expStr, sig string) (userID int64, exp int64, ok bool) {
	uid, err1 := strconv.ParseInt(u, 10, 64)
	exp, err2 := strconv.ParseInt(expStr, 10, 64)
	if err1 != nil || err2 != nil || uid <= 0 || exp <= 0 || sig == "" {
		return 0, 0, false
	}
	return uid, exp, true
}
