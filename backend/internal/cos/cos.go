package cos

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"jarin-wardrobe/internal/config"

	"github.com/google/uuid"
	tencentcos "github.com/tencentyun/cos-go-sdk-v5"
)

type Client struct {
	cfg    config.Config
	client *tencentcos.Client
}

func New(cfg config.Config) (*Client, error) {
	if !cfg.COSEnabled() {
		return &Client{cfg: cfg}, nil
	}
	raw := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.COSBucket, cfg.COSRegion)
	u, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	b := &tencentcos.BaseURL{BucketURL: u}
	cli := tencentcos.NewClient(b, &http.Client{
		Transport: &tencentcos.AuthorizationTransport{
			SecretID:  cfg.COSSecretID,
			SecretKey: cfg.COSSecretKey,
		},
	})
	return &Client{cfg: cfg, client: cli}, nil
}

func (c *Client) Enabled() bool {
	return c != nil && c.client != nil && c.cfg.COSEnabled()
}

func (c *Client) Upload(ctx context.Context, userID int64, filename string, r io.Reader, contentType string) (string, string, error) {
	if !c.Enabled() {
		return "", "", fmt.Errorf("未配置腾讯云 COS（请设置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION）")
	}
	ext := strings.ToLower(path.Ext(filename))
	if ext == "" {
		ext = guessExt(contentType)
	}
	now := time.Now()
	prefix := strings.Trim(c.cfg.COSPrefix, "/")
	var key string
	if prefix == "" {
		key = fmt.Sprintf("%d/%04d/%02d/%s%s", userID, now.Year(), int(now.Month()), uuid.NewString(), ext)
	} else {
		key = fmt.Sprintf("%s/%d/%04d/%02d/%s%s", prefix, userID, now.Year(), int(now.Month()), uuid.NewString(), ext)
	}
	opt := &tencentcos.ObjectPutOptions{
		ObjectPutHeaderOptions: &tencentcos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	}
	_, err := c.client.Object.Put(ctx, key, r, opt)
	if err != nil {
		return "", "", err
	}
	return c.publicURL(key), key, nil
}

func (c *Client) publicURL(key string) string {
	key = strings.TrimPrefix(key, "/")
	if d := strings.TrimRight(c.cfg.COSCDNDomain, "/"); d != "" {
		if !strings.HasPrefix(d, "http") {
			d = "https://" + d
		}
		return d + "/" + key
	}
	return fmt.Sprintf("https://%s.cos.%s.myqcloud.com/%s", c.cfg.COSBucket, c.cfg.COSRegion, key)
}

// InternalURL 服务端访问 COS 的地址（未签名；私有桶会 403，AI 请用 PresignedGetURL）
func (c *Client) InternalURL(key string) string {
	if key == "" {
		return ""
	}
	return c.publicURL(strings.TrimPrefix(key, "/"))
}

// PresignedGetURL 生成短时预签名下载链，供 AI 等多模态服务拉图（私有桶可用）
func (c *Client) PresignedGetURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("未配置腾讯云 COS")
	}
	key = strings.TrimPrefix(strings.TrimSpace(key), "/")
	if key == "" {
		return "", fmt.Errorf("空对象键")
	}
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	u, err := c.client.Object.GetPresignedURL(
		ctx,
		http.MethodGet,
		key,
		c.cfg.COSSecretID,
		c.cfg.COSSecretKey,
		ttl,
		nil,
	)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// Delete 硬删除 COS 对象
func (c *Client) Delete(ctx context.Context, key string) error {
	if !c.Enabled() {
		return fmt.Errorf("未配置腾讯云 COS")
	}
	key = strings.TrimPrefix(strings.TrimSpace(key), "/")
	if key == "" {
		return nil
	}
	_, err := c.client.Object.Delete(ctx, key)
	return err
}

// GetObject 读取对象流（媒体代理）
func (c *Client) GetObject(ctx context.Context, key string) (io.ReadCloser, string, error) {
	if !c.Enabled() {
		return nil, "", fmt.Errorf("未配置腾讯云 COS")
	}
	key = strings.TrimPrefix(strings.TrimSpace(key), "/")
	resp, err := c.client.Object.Get(ctx, key, nil)
	if err != nil {
		return nil, "", err
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	return resp.Body, ct, nil
}

func guessExt(contentType string) string {
	switch strings.ToLower(contentType) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".jpg"
	}
}
