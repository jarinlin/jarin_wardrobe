package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"jarin-wardrobe/internal/amap"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"
	"jarin-wardrobe/internal/suggest"

	"github.com/gin-gonic/gin"
)

type SuggestHandler struct {
	Cfg  config.Config
	Amap *amap.Client
}

func (h SuggestHandler) Outfit(c *gin.Context) {
	uid := middleware.UserID(c)

	weatherIn := suggest.WeatherInput{}
	var weatherOut any
	if h.Amap != nil && h.Amap.Enabled() {
		lat, lng, err := parseLatLng(c)
		if err == nil {
			ctx := c.Request.Context()
			w, werr := h.Amap.WeatherByCoord(ctx, lat, lng)
			if werr != nil {
				log.Printf("[suggest] weather degrade: %v", werr)
			} else if w != nil {
				weatherIn = suggest.WeatherInput{
					City:        w.City,
					Weather:     w.Weather,
					Temperature: w.Temperature,
					TempC:       w.TempC,
					HasWeather:  true,
				}
				weatherOut = w
			}
		}
	} else {
		weatherIn.HasWeather = false
	}

	rows, err := db.Pool.Query(c, `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.color, c.image_url,
		       c.tags, COALESCE(c.tags_status,''), c.wear_count, c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.user_id=$1
		ORDER BY c.id DESC
		LIMIT 200`, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()

	list := make([]suggest.Clothing, 0)
	for rows.Next() {
		var (
			id, categoryID                                int64
			name, catName, color, imageStored, tagsStatus string
			tagsJSON                                      []byte
			wearCount                                     int
			createdAt                                     time.Time
		)
		if err := rows.Scan(&id, &categoryID, &name, &catName, &color, &imageStored, &tagsJSON, &tagsStatus, &wearCount, &createdAt); err != nil {
			continue
		}
		_ = createdAt
		var tags []string
		if len(tagsJSON) > 0 {
			_ = json.Unmarshal(tagsJSON, &tags)
		}
		list = append(list, suggest.Clothing{
			ID:           id,
			Name:         name,
			CategoryID:   categoryID,
			CategoryName: catName,
			Color:        color,
			ImageURL:     media.ProxyURL(h.Cfg, uid, imageStored),
			Tags:         tags,
			TagsStatus:   tagsStatus,
			WearCount:    wearCount,
		})
	}

	result := suggest.BuildOutfit(list, weatherIn)
	response.OK(c, gin.H{
		"items":       result.Items,
		"reason":      result.Reason,
		"tips":        result.Tips,
		"seasonHint":  result.SeasonHint,
		"weatherNote": result.WeatherNote,
		"weather":     weatherOut,
	})
}
