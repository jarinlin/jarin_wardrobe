package handler

import (
	"log"
	"net/http"
	"time"

	"jarin-wardrobe/internal/apptime"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type OutfitsHandler struct {
	Cfg config.Config
	COS *cos.Client
}

type outfitBody struct {
	Date        string  `json:"date"`
	Note        string  `json:"note"`
	ImageURL    string  `json:"imageUrl"`
	ClothingIDs []int64 `json:"clothingIds"`
}

func (h OutfitsHandler) attachClothes(c *gin.Context, uid, outfitID int64, date time.Time, note, imageStored string, wearCount int) (gin.H, error) {
	rows, err := db.Pool.Query(c, `
		SELECT c.id, c.name, c.color, c.brand, c.image_url, COALESCE(cat.name,'')
		FROM outfit_items oi
		JOIN clothes c ON c.id = oi.clothing_id
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE oi.outfit_id=$1`, outfitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	clothes := make([]gin.H, 0)
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		var name, color, brand, image, catName string
		if err := rows.Scan(&id, &name, &color, &brand, &image, &catName); err != nil {
			return nil, err
		}
		ids = append(ids, id)
		clothes = append(clothes, gin.H{
			"id": id, "name": name, "color": color, "brand": brand,
			"imageUrl": media.ProxyURL(h.Cfg, uid, image), "categoryName": catName,
		})
	}
	return gin.H{
		"id":          outfitID,
		"date":        apptime.FormatDate(date),
		"note":        note,
		"imageUrl":    media.ProxyURL(h.Cfg, uid, imageStored),
		"wearCount":   wearCount,
		"clothingIds": ids,
		"clothes":     clothes,
	}, nil
}

func (h OutfitsHandler) List(c *gin.Context) {
	uid := middleware.UserID(c)
	rows, err := db.Pool.Query(c, `
		SELECT id, outfit_date, note, image_url, wear_count
		FROM outfits WHERE user_id=$1
		ORDER BY outfit_date DESC, id DESC`, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()
	list := make([]gin.H, 0)
	for rows.Next() {
		var id int64
		var date time.Time
		var note, image string
		var wear int
		if err := rows.Scan(&id, &date, &note, &image, &wear); err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		item, err := h.attachClothes(c, uid, id, date, note, image, wear)
		if err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		list = append(list, item)
	}
	response.OK(c, list)
}

func (h OutfitsHandler) Today(c *gin.Context) {
	uid := middleware.UserID(c)
	date := c.Query("date")
	if date == "" {
		response.Fail(c, "缺少 date", 1, http.StatusOK)
		return
	}
	var id int64
	var d time.Time
	var note, image string
	var wear int
	err := db.Pool.QueryRow(c, `
		SELECT id, outfit_date, note, image_url, wear_count
		FROM outfits
		WHERE user_id=$1 AND outfit_date=$2::date
		LIMIT 1`, uid, date,
	).Scan(&id, &d, &note, &image, &wear)
	if err != nil {
		response.OK(c, nil)
		return
	}
	item, err := h.attachClothes(c, uid, id, d, note, image, wear)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, item)
}

func (h OutfitsHandler) Detail(c *gin.Context) {
	uid := middleware.UserID(c)
	var id int64
	var d time.Time
	var note, image string
	var wear int
	err := db.Pool.QueryRow(c, `
		SELECT id, outfit_date, note, image_url, wear_count
		FROM outfits WHERE id=$1 AND user_id=$2 LIMIT 1`,
		c.Param("id"), uid,
	).Scan(&id, &d, &note, &image, &wear)
	if err != nil {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}
	item, err := h.attachClothes(c, uid, id, d, note, image, wear)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, item)
}

func (h OutfitsHandler) Create(c *gin.Context) {
	uid := middleware.UserID(c)
	var body outfitBody
	_ = c.ShouldBindJSON(&body)
	if body.Date == "" {
		response.Fail(c, "缺少日期", 1, http.StatusOK)
		return
	}
	if len(body.ClothingIDs) == 0 {
		response.Fail(c, "请选择衣物", 1, http.StatusOK)
		return
	}

	imageKey := media.NormalizeForStore(h.Cfg, body.ImageURL)
	var outfitID int64
	var existingID int64
	var oldImage string
	err := db.Pool.QueryRow(c, `
		SELECT id, image_url FROM outfits
		WHERE user_id=$1 AND outfit_date=$2::date LIMIT 1`,
		uid, body.Date,
	).Scan(&existingID, &oldImage)
	if err == nil {
		outfitID = existingID
		_, _ = db.Pool.Exec(c, `
			UPDATE outfits SET note=$1, image_url=$2, wear_count=wear_count+1, deleted_at=NULL WHERE id=$3`,
			body.Note, imageKey, outfitID)
		_, _ = db.Pool.Exec(c, `DELETE FROM outfit_items WHERE outfit_id=$1`, outfitID)
		oldKey := media.ExtractKey(h.Cfg, oldImage)
		if oldKey != "" && oldKey != imageKey && h.COS != nil && h.COS.Enabled() {
			if err := h.COS.Delete(c.Request.Context(), oldKey); err != nil {
				log.Printf("[cos] 删除旧穿搭图失败 key=%s err=%v", oldKey, err)
			}
		}
	} else {
		err = db.Pool.QueryRow(c, `
			INSERT INTO outfits (user_id, outfit_date, note, image_url, wear_count)
			VALUES ($1,$2::date,$3,$4,1) RETURNING id`,
			uid, body.Date, body.Note, imageKey,
		).Scan(&outfitID)
		if err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
	}

	for _, cid := range body.ClothingIDs {
		_, _ = db.Pool.Exec(c, `INSERT INTO outfit_items (outfit_id, clothing_id) VALUES ($1,$2)`, outfitID, cid)
		_, _ = db.Pool.Exec(c, `UPDATE clothes SET wear_count=wear_count+1 WHERE id=$1 AND user_id=$2`, cid, uid)
	}

	c.Params = gin.Params{{Key: "id", Value: itoa64(outfitID)}}
	h.Detail(c)
}

func (h OutfitsHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	id := c.Param("id")
	var imageStored string
	err := db.Pool.QueryRow(c,
		`SELECT image_url FROM outfits WHERE id=$1 AND user_id=$2`, id, uid,
	).Scan(&imageStored)
	if err != nil {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}

	tx, err := db.Pool.Begin(c)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer tx.Rollback(c)
	if _, err := tx.Exec(c, `DELETE FROM outfit_items WHERE outfit_id=$1`, id); err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	tag, err := tx.Exec(c, `DELETE FROM outfits WHERE id=$1 AND user_id=$2`, id, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(c, "记录不存在", 404, http.StatusNotFound)
		return
	}
	if err := tx.Commit(c); err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}

	key := media.ExtractKey(h.Cfg, imageStored)
	if key != "" && h.COS != nil && h.COS.Enabled() {
		if err := h.COS.Delete(c.Request.Context(), key); err != nil {
			log.Printf("[cos] 删除穿搭图失败 key=%s err=%v", key, err)
		}
	}
	response.OK(c, true)
}
