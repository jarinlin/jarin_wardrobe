package tagging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"jarin-wardrobe/internal/ai"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/media"
)

var errNoImage = errors.New("无图片，跳过打标")

type Worker struct {
	Cfg    config.Config
	Client *ai.Client
	COS    *cos.Client
}

// EnqueueClothing 异步打标并写回 clothes.tags / tags_status
func (w *Worker) EnqueueClothing(userID, clothingID int64) {
	if w == nil || w.Client == nil || !w.Cfg.AIEnabled() {
		return
	}
	// 先同步标记 pending，避免创建接口立刻 Detail 时仍是空状态
	_, _ = db.Pool.Exec(context.Background(),
		`UPDATE clothes SET tags_status='pending', updated_at=NOW() WHERE id=$1 AND user_id=$2`,
		clothingID, userID)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		if err := w.tagClothing(ctx, userID, clothingID); err != nil {
			log.Printf("[tagging] clothing=%d failed: %v", clothingID, err)
			_, _ = db.Pool.Exec(context.Background(),
				`UPDATE clothes SET tags_status='failed', updated_at=NOW() WHERE id=$1 AND user_id=$2`,
				clothingID, userID)
		}
	}()
}

func (w *Worker) tagClothing(ctx context.Context, userID, clothingID int64) error {
	var imageStored, name, color, brand, catName string
	err := db.Pool.QueryRow(ctx, `
		SELECT c.image_url, c.name, c.color, c.brand, COALESCE(cat.name,'')
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.id=$1 AND c.user_id=$2`, clothingID, userID,
	).Scan(&imageStored, &name, &color, &brand, &catName)
	if err != nil {
		return err
	}
	key := media.ExtractKey(w.Cfg, imageStored)
	if key == "" {
		return errNoImage
	}
	imageURL := key
	if w.COS != nil && w.COS.Enabled() {
		signed, err := w.COS.PresignedGetURL(ctx, key, 30*time.Minute)
		if err != nil {
			return fmt.Errorf("预签名失败: %w", err)
		}
		if signed == "" {
			return fmt.Errorf("预签名失败: 空地址")
		}
		imageURL = signed
	}

	result, err := ai.TagClothingImage(ctx, w.Client, imageURL, name, catName, color, brand)
	if err != nil {
		return err
	}
	raw, _ := json.Marshal(result.Tags)
	_, err = db.Pool.Exec(ctx, `
		UPDATE clothes SET tags=$1::jsonb, tags_status='ready', updated_at=NOW()
		WHERE id=$2 AND user_id=$3`, string(raw), clothingID, userID)
	if err != nil {
		return err
	}
	log.Printf("[tagging] clothing=%d ready tags=%d", clothingID, len(result.Tags))
	return nil
}
