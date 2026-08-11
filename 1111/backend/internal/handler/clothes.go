package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type ClothesHandler struct{}

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

func mapClothing(id, categoryID int64, name, categoryName, brand, color, size string, buyDate *time.Time, price float64, wearCount int, remark, imageURL string, tags []byte, createdAt time.Time) gin.H {
	var tagList []string
	if len(tags) > 0 {
		_ = json.Unmarshal(tags, &tagList)
	}
	if tagList == nil {
		tagList = []string{}
	}
	var buy string
	if buyDate != nil {
		buy = buyDate.Format("2006-01-02")
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
		"imageUrl":     imageURL,
		"tags":         tagList,
		"createdAt":    createdAt,
	}
}

func (ClothesHandler) List(c *gin.Context) {
	uid := middleware.UserID(c)
	sql := `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.brand, c.color, c.size,
		       c.buy_date, c.price::float8, c.wear_count, c.remark, c.image_url, c.tags, c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.user_id=$1 AND c.deleted_at IS NULL`
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
		item, err := scanClothing(rows)
		if err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		list = append(list, item)
	}
	response.OK(c, list)
}

func (ClothesHandler) Detail(c *gin.Context) {
	uid := middleware.UserID(c)
	row := db.Pool.QueryRow(c, `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.brand, c.color, c.size,
		       c.buy_date, c.price::float8, c.wear_count, c.remark, c.image_url, c.tags, c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL
		LIMIT 1`, c.Param("id"), uid)
	item, err := scanClothingRow(row)
	if err != nil {
		response.Fail(c, "衣物不存在", 404, http.StatusNotFound)
		return
	}
	response.OK(c, item)
}

func (ClothesHandler) Create(c *gin.Context) {
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
	var id int64
	err := db.Pool.QueryRow(c, `
		INSERT INTO clothes
		  (user_id, category_id, name, brand, color, size, buy_date, price, wear_count, remark, image_url, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
		RETURNING id`,
		uid, body.CategoryID, body.Name, body.Brand, body.Color, body.Size, buy,
		body.Price, body.WearCount, body.Remark, body.ImageURL, string(tags),
	).Scan(&id)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	row := db.Pool.QueryRow(c, `
		SELECT c.id, c.category_id, c.name, COALESCE(cat.name,''), c.brand, c.color, c.size,
		       c.buy_date, c.price::float8, c.wear_count, c.remark, c.image_url, c.tags, c.created_at
		FROM clothes c
		LEFT JOIN categories cat ON cat.id = c.category_id
		WHERE c.id=$1 AND c.user_id=$2 LIMIT 1`, id, uid)
	item, err := scanClothingRow(row)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, item)
}

func (ClothesHandler) Update(c *gin.Context) {
	uid := middleware.UserID(c)
	var body clothingBody
	_ = c.ShouldBindJSON(&body)
	body.Name = strings.TrimSpace(body.Name)
	if body.Tags == nil {
		body.Tags = []string{}
	}
	tags, _ := json.Marshal(body.Tags)
	var buy any
	if strings.TrimSpace(body.BuyDate) != "" {
		buy = body.BuyDate
	}
	_, err := db.Pool.Exec(c, `
		UPDATE clothes SET
		  category_id=$1, name=$2, brand=$3, color=$4, size=$5, buy_date=$6,
		  price=$7, remark=$8, image_url=$9, tags=$10::jsonb
		WHERE id=$11 AND user_id=$12 AND deleted_at IS NULL`,
		body.CategoryID, body.Name, body.Brand, body.Color, body.Size, buy,
		body.Price, body.Remark, body.ImageURL, string(tags), c.Param("id"), uid,
	)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	ClothesHandler{}.Detail(c)
}

func (ClothesHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	_, err := db.Pool.Exec(c, `UPDATE clothes SET deleted_at=NOW() WHERE id=$1 AND user_id=$2`, c.Param("id"), uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, true)
}

type scannable interface {
	Scan(dest ...any) error
}

func scanClothing(rows pgx.Rows) (gin.H, error) {
	return scanClothingRow(rows)
}

func scanClothingRow(row scannable) (gin.H, error) {
	var (
		id, categoryID                       int64
		name, categoryName, brand, color, size string
		buyDate                              *time.Time
		price                                float64
		wearCount                            int
		remark, imageURL                     string
		tags                                 []byte
		createdAt                            time.Time
	)
	err := row.Scan(&id, &categoryID, &name, &categoryName, &brand, &color, &size, &buyDate, &price, &wearCount, &remark, &imageURL, &tags, &createdAt)
	if err != nil {
		return nil, err
	}
	return mapClothing(id, categoryID, name, categoryName, brand, color, size, buyDate, price, wearCount, remark, imageURL, tags, createdAt), nil
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
