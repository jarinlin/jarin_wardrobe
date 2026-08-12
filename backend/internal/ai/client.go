package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"jarin-wardrobe/internal/config"
)

type Client struct {
	BaseURL    string
	APIKey     string
	Model      string
	HTTPClient *http.Client
}

func NewClient(cfg config.Config) *Client {
	timeout := time.Duration(cfg.AITimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &Client{
		BaseURL: strings.TrimRight(cfg.AIBaseURL, "/"),
		APIKey:  cfg.AIAPIKey,
		Model:   cfg.AIModel,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
	}
}

type chatRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	Temperature    float64       `json:"temperature,omitempty"`
	EnableThinking *bool         `json:"enable_thinking,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type contentPart struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *imageURL `json:"image_url,omitempty"`
}

type imageURL struct {
	URL string `json:"url"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content any `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// ChatVision 调用多模态 chat/completions，返回助手文本。
func (c *Client) ChatVision(ctx context.Context, systemPrompt, userText, imageURLStr string) (string, error) {
	if c == nil || c.BaseURL == "" || c.APIKey == "" || c.Model == "" {
		return "", fmt.Errorf("AI 未配置")
	}
	off := false
	reqBody := chatRequest{
		Model: c.Model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{
				Role: "user",
				Content: []contentPart{
					{Type: "text", Text: userText},
					{Type: "image_url", ImageURL: &imageURL{URL: imageURLStr}},
				},
			},
		},
		Temperature:    0.2,
		EnableThinking: &off,
	}
	raw, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := c.BaseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI 请求失败: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var parsed chatResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("AI 响应解析失败: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("%s", parsed.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("AI 接口错误 HTTP %d: %s", resp.StatusCode, truncate(string(body), 240))
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("AI 无返回内容")
	}
	return extractText(parsed.Choices[0].Message.Content), nil
}

func extractText(content any) string {
	switch v := content.(type) {
	case string:
		return strings.TrimSpace(v)
	case []any:
		var b strings.Builder
		for _, part := range v {
			m, ok := part.(map[string]any)
			if !ok {
				continue
			}
			if t, ok := m["text"].(string); ok {
				b.WriteString(t)
			}
		}
		return strings.TrimSpace(b.String())
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
