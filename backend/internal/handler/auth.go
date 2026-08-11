package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AuthHandler struct {
	Cfg config.Config
}

type loginBody struct {
	Code      string `json:"code"`
	NickName  string `json:"nickName"`
	AvatarURL string `json:"avatarUrl"`
}

func (h AuthHandler) Login(c *gin.Context) {
	var body loginBody
	_ = c.ShouldBindJSON(&body)

	openid := c.GetHeader("x-wx-openid")
	if openid == "" {
		openid = c.GetHeader("X-WX-OPENID")
	}
	if openid == "" {
		sid, err := h.code2Session(body.Code)
		if err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		openid = sid
	}

	user, err := upsertUser(c.Request.Context(), openid, body.NickName, body.AvatarURL)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.Claims{
		UserID: user.ID,
		OpenID: user.OpenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		},
	})
	signed, err := token.SignedString([]byte(h.Cfg.JWTSecret))
	if err != nil {
		response.Fail(c, "签发登录态失败", 1, http.StatusOK)
		return
	}

	response.OK(c, gin.H{
		"token": signed,
		"user": gin.H{
			"id":        user.ID,
			"nickname":  user.Nickname,
			"avatarUrl": user.AvatarURL,
			"openid":    user.OpenID,
		},
	})
}

type profileBody struct {
	NickName  string `json:"nickName"`
	AvatarURL string `json:"avatarUrl"`
}

// UpdateProfile 登录后更新昵称/头像（用于 chooseAvatar 临时文件上传 COS 后回写）
func (h AuthHandler) UpdateProfile(c *gin.Context) {
	uid := middleware.UserID(c)
	var body profileBody
	_ = c.ShouldBindJSON(&body)

	_, err := db.Pool.Exec(c.Request.Context(),
		`UPDATE users SET
			nickname = COALESCE(NULLIF($1,''), nickname),
			avatar_url = COALESCE(NULLIF($2,''), avatar_url)
		 WHERE id=$3`, body.NickName, body.AvatarURL, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}

	var u userRow
	if err := db.Pool.QueryRow(c.Request.Context(),
		`SELECT id, openid, nickname, avatar_url FROM users WHERE id=$1`, uid,
	).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL); err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}

	response.OK(c, gin.H{
		"id":        u.ID,
		"nickname":  u.Nickname,
		"avatarUrl": u.AvatarURL,
		"openid":    u.OpenID,
	})
}

func (h AuthHandler) code2Session(code string) (string, error) {
	if h.Cfg.WXAppID == "" || h.Cfg.WXSecret == "" {
		if h.Cfg.AllowMockLogin {
			if code == "" {
				code = "mock_code"
			}
			return "mock_" + code, nil
		}
		return "", fmt.Errorf("未配置微信 AppID/Secret")
	}
	if code == "" && !h.Cfg.AllowMockLogin {
		return "", fmt.Errorf("缺少登录凭证")
	}
	if code == "" {
		code = "mock_code"
	}

	u := "https://api.weixin.qq.com/sns/jscode2session?appid=" + url.QueryEscape(h.Cfg.WXAppID) +
		"&secret=" + url.QueryEscape(h.Cfg.WXSecret) +
		"&js_code=" + url.QueryEscape(code) +
		"&grant_type=authorization_code"
	resp, err := http.Get(u)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var data struct {
		OpenID     string `json:"openid"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
		SessionKey string `json:"session_key"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", err
	}
	if data.ErrCode != 0 {
		if h.Cfg.AllowMockLogin {
			return "mock_" + code, nil
		}
		return "", fmt.Errorf(data.ErrMsg)
	}
	return data.OpenID, nil
}

type userRow struct {
	ID        int64
	OpenID    string
	Nickname  string
	AvatarURL string
}

func upsertUser(ctx context.Context, openid, nickName, avatarURL string) (*userRow, error) {
	var u userRow
	err := db.Pool.QueryRow(ctx,
		`SELECT id, openid, nickname, avatar_url FROM users WHERE openid=$1 LIMIT 1`, openid,
	).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL)
	if err == nil {
		if nickName != "" || avatarURL != "" {
			_, _ = db.Pool.Exec(ctx,
				`UPDATE users SET
					nickname = COALESCE(NULLIF($1,''), nickname),
					avatar_url = COALESCE(NULLIF($2,''), avatar_url)
				 WHERE id=$3`, nickName, avatarURL, u.ID)
			_ = db.Pool.QueryRow(ctx,
				`SELECT id, openid, nickname, avatar_url FROM users WHERE id=$1`, u.ID,
			).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL)
		}
		return &u, nil
	}

	if nickName == "" {
		nickName = "Jarin"
	}
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO users (openid, nickname, avatar_url) VALUES ($1,$2,$3) RETURNING id, openid, nickname, avatar_url`,
		openid, nickName, avatarURL,
	).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL)
	if err != nil {
		return nil, err
	}

	defaults := []string{"上衣", "裤装", "外套", "鞋子", "包", "配饰"}
	for i, name := range defaults {
		_, _ = db.Pool.Exec(ctx,
			`INSERT INTO categories (user_id, name, sort_order) VALUES ($1,$2,$3)`,
			u.ID, name, i+1,
		)
	}
	return &u, nil
}
