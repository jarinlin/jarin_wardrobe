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
	key := fmt.Sprintf(
		"%s/%d/%04d/%02d/%s%s",
		strings.Trim(c.cfg.COSPrefix, "/"),
		userID,
		now.Year(),
		int(now.Month()),
		uuid.NewString(),
		ext,
	)
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
