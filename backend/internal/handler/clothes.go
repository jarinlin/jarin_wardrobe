package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"jarin-wardrobe/internal/apptime"
	"jarin-wardrobe/internal/config"
	"jarin-wardrobe/internal/cos"
	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/media"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"
	"jarin-wardrobe/internal/tagging"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type ClothesHandler struct {
	Cfg    config.Config
	COS    *cos.Client
	Tagger *tagging.Worker
}

type clothingBody struct {
	Name       string   `json:"name"`
	CategoryID int64    `json:"categoryId"`
	Brand      string   `json:"brand"`
	Color      string   `json:"color"`
	Size       string   `json:"size"`
	BuyDate    string   `json:"buyDate"`
	Price      float64  `json:"price"`
	WearCount  int      `json:"wearCount"`
	Remark     string   `json:"remark"`
	ImageURL   string   `json:"imageUrl"`
	Tags       []string `json:"tags"`
}

func (h ClothesHandler) mapClothing(uid, id, categoryID int64, name, categoryName, brand, color, size string, buyDate *time.Time, price float64, wearCount int, remark, imageStored string, tags []byte, tagsStatus string, createdAt time.Time) gin.H {
	var tagList []string
	if len(tags) > 0 {
		_ = json.Unmarshal(tags, &tagList)
	}
	if tagList == nil {
		tagList = []string{}
	}
	var buy string
	if buyDate != nil {
		buy = apptime.FormatDate(*buyDate)
	}
	return gin.H{
		"id":           id,
		"name":         name,
		"categoryId":   categoryID,
		"categoryName": categoryName,
		"brand":        brand,
		"color":        color,
		"size":         size,
		"buyDate":      buy,
		"price":        price,
		"wearCount":    wearCount,
		"remark":       remark,
		"imageUrl":     media.ProxyURL(h.Cfg, uid, imageStored),
		"tags":         tagList,
		"tagsStatus":   tagsStatus,
		"createdAt":    apptime.FormatRFC3339(createdAt),
	}
}

func (h ClothesHandler) List(c *gin.Context) {
	uid := middleware.UserID(c)
	sql := `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.brand, c.color, c.size,
		       c.buy_date, c.price::float8, c.wear_count, c.remark, c.image_url, c.tags,
		       COALESCE(c.tags_status,''), c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.user_id=$1`
	args := []any{uid}
	n := 2
	if cid := c.Query("categoryId"); cid != "" {
		sql += " AND c.category_id=$" + itoa(n)
		args = append(args, cid)
		n++
	}
	if kw := strings.TrimSpace(c.Query("keyword")); kw != "" {
		sql += " AND (c.name ILIKE $" + itoa(n) + " OR c.brand ILIKE $" + itoa(n) + " OR c.color ILIKE $" + itoa(n) + ")"
		args = append(args, "%"+kw+"%")
		n++
	}
	sql += " ORDER BY c.id DESC"

	rows, err := db.Pool.Query(c, sql, args...)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()
	list := make([]gin.H, 0)
	for rows.Next() {
		item, err := h.scanClothing(rows, uid)
		if err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		list = append(list, item)
	}
	response.OK(c, list)
}

func (h ClothesHandler) Detail(c *gin.Context) {
	uid := middleware.UserID(c)
	row := db.Pool.QueryRow(c, `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.brand, c.color, c.size,
		       c.buy_date, c.price::float8, c.wear_count, c.remark, c.image_url, c.tags,
		       COALESCE(c.tags_status,''), c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.id=$1 AND c.user_id=$2
		LIMIT 1`, c.Param("id"), uid)
	item, err := h.scanClothingRow(row, uid)
	if err != nil {
		response.Fail(c, "衣物不存在", 404, http.StatusNotFound)
		return
	}
	response.OK(c, item)
}

func (h ClothesHandler) Create(c *gin.Context) {
	uid := middleware.UserID(c)
	var body clothingBody
	_ = c.ShouldBindJSON(&body)
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" || body.CategoryID == 0 {
		response.Fail(c, "名称和分类必填", 1, http.StatusOK)
		return
	}
	if body.Tags == nil {
		body.Tags = []string{}
	}
	tags, _ := json.Marshal(body.Tags)
	var buy any
	if strings.TrimSpace(body.BuyDate) != "" {
		buy = body.BuyDate
	}
	imageKey := media.NormalizeForStore(h.Cfg, body.ImageURL)
	var id int64
	err := db.Pool.QueryRow(c, `
		INSERT INTO clothes
		  (user_id, category_id, name, brand, color, size, buy_date, price, wear_count, remark, image_url, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
		RETURNING id`,
		uid, body.CategoryID, body.Name, body.Brand, body.Color, body.Size, buy,
		body.Price, body.WearCount, body.Remark, imageKey, string(tags),
	).Scan(&id)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if imageKey != "" {
		h.Tagger.EnqueueClothing(uid, id)
	}
	c.Params = gin.Params{{Key: "id", Value: itoa64(id)}}
	h.Detail(c)
}

func (h ClothesHandler) Update(c *gin.Context) {
	uid := middleware.UserID(c)
	var body clothingBody
	_ = c.ShouldBindJSON(&body)
	body.Name = strings.TrimSpace(body.Name)
	var buy any
	if strings.TrimSpace(body.BuyDate) != "" {
		buy = body.BuyDate
	}

	var oldImage string
	var oldTags []byte
	_ = db.Pool.QueryRow(c,
		`SELECT image_url, tags FROM clothes WHERE id=$1 AND user_id=$2`, c.Param("id"), uid,
	).Scan(&oldImage, &oldTags)
	imageKey := media.NormalizeForStore(h.Cfg, body.ImageURL)
	oldKey := media.ExtractKey(h.Cfg, oldImage)
	// 客户端未传图时保留原图，避免空串覆盖
	if imageKey == "" && strings.TrimSpace(body.ImageURL) == "" {
		imageKey = oldKey
		if imageKey == "" {
			imageKey = oldImage
		}
	}

	// 客户端传空 tags 时保留已有 AI 标签，避免覆盖
	tagsJSON := resolveTagsForUpdate(body.Tags, oldTags)

	_, err := db.Pool.Exec(c, `
		UPDATE clothes SET
		  category_id=$1, name=$2, brand=$3, color=$4, size=$5, buy_date=$6,
		  price=$7, remark=$8, image_url=$9, tags=$10::jsonb, updated_at=NOW()
		WHERE id=$11 AND user_id=$12`,
		body.CategoryID, body.Name, body.Brand, body.Color, body.Size, buy,
		body.Price, body.Remark, imageKey, tagsJSON, c.Param("id"), uid,
	)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if oldKey != "" && oldKey != imageKey && h.COS != nil && h.COS.Enabled() {
		if err := h.COS.Delete(c.Request.Context(), oldKey); err != nil {
			log.Printf("[cos] 删除旧衣物图失败 key=%s err=%v", oldKey, err)
		}
	}

	// 有图且（新建图或换图）时重新异步打标
	if imageKey != "" && imageKey != oldKey {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		h.Tagger.EnqueueClothing(uid, id)
	}
	h.Detail(c)
}

// Retag 手动触发重新打标
func (h ClothesHandler) Retag(c *gin.Context) {
	uid := middleware.UserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		response.Fail(c, "无效衣物 ID", 1, http.StatusOK)
		return
	}
	if h.Tagger == nil || !h.Cfg.AIEnabled() {
		response.Fail(c, "AI 未配置，无法打标", 1, http.StatusOK)
		return
	}
	var imageStored string
	err = db.Pool.QueryRow(c,
		`SELECT image_url FROM clothes WHERE id=$1 AND user_id=$2`, id, uid,
	).Scan(&imageStored)
	if err != nil {
		response.Fail(c, "衣物不存在", 404, http.StatusNotFound)
		return
	}
	if media.ExtractKey(h.Cfg, imageStored) == "" {
		response.Fail(c, "无图片，无法打标", 1, http.StatusOK)
		return
	}
	h.Tagger.EnqueueClothing(uid, id)
	response.OK(c, gin.H{"queued": true, "tagsStatus": "pending"})
}

func (h ClothesHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	id := c.Param("id")

	var imageStored string
	err := db.Pool.QueryRow(c,
		`SELECT image_url FROM clothes WHERE id=$1 AND user_id=$2`, id, uid,
	).Scan(&imageStored)
	if err != nil {
		response.Fail(c, "衣物不存在", 404, http.StatusNotFound)
		return
	}

	tx, err := db.Pool.Begin(c)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer tx.Rollback(c)

	if _, err := tx.Exec(c, `DELETE FROM outfit_items WHERE clothing_id=$1`, id); err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	tag, err := tx.Exec(c, `DELETE FROM clothes WHERE id=$1 AND user_id=$2`, id, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(c, "衣物不存在", 404, http.StatusNotFound)
		return
	}
	if err := tx.Commit(c); err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}

	key := media.ExtractKey(h.Cfg, imageStored)
	if key != "" && h.COS != nil && h.COS.Enabled() {
		if err := h.COS.Delete(c.Request.Context(), key); err != nil {
			log.Printf("[cos] 删除衣物图失败 key=%s err=%v", key, err)
		}
	}
	response.OK(c, true)
}

type scannable interface {
	Scan(dest ...any) error
}

func (h ClothesHandler) scanClothing(rows pgx.Rows, uid int64) (gin.H, error) {
	return h.scanClothingRow(rows, uid)
}

func (h ClothesHandler) scanClothingRow(row scannable, uid int64) (gin.H, error) {
	var (
		id, categoryID                         int64
		name, categoryName, brand, color, size string
		buyDate                                *time.Time
		price                                  float64
		wearCount                              int
		remark, imageURL, tagsStatus           string
		tags                                   []byte
		createdAt                              time.Time
	)
	err := row.Scan(&id, &categoryID, &name, &categoryName, &brand, &color, &size, &buyDate, &price, &wearCount, &remark, &imageURL, &tags, &tagsStatus, &createdAt)
	if err != nil {
		return nil, err
	}
	return h.mapClothing(uid, id, categoryID, name, categoryName, brand, color, size, buyDate, price, wearCount, remark, imageURL, tags, tagsStatus, createdAt), nil
}

// resolveTagsForUpdate：客户端 nil/空切片不覆盖库内已有 tags
func resolveTagsForUpdate(incoming []string, oldTags []byte) string {
	if len(incoming) == 0 {
		if len(oldTags) == 0 {
			return "[]"
		}
		return string(oldTags)
	}
	raw, _ := json.Marshal(incoming)
	return string(raw)
}

func itoa(n int) string {
	return itoa64(int64(n))
}

func itoa64(n int64) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
