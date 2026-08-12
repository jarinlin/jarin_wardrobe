package handler

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type TagsHandler struct{}

type tagCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Aggregate 聚合衣物 tags + 用户自定义 tags 表
func (TagsHandler) Aggregate(c *gin.Context) {
	uid := middleware.UserID(c)

	fromClothes := aggregateClothesTags(c, uid)

	rows, err := db.Pool.Query(c, `
		SELECT id, name FROM tags
		WHERE user_id=$1 AND deleted_at IS NULL
		ORDER BY id ASC`, uid)
	list := make([]gin.H, 0)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var name string
			if err := rows.Scan(&id, &name); err == nil {
				list = append(list, gin.H{"id": id, "name": name})
			}
		}
	}

	response.OK(c, gin.H{
		"fromClothes": fromClothes,
		"list":        list,
	})
}

func aggregateClothesTags(c *gin.Context, uid int64) []tagCount {
	rows, err := db.Pool.Query(c, `
		SELECT tags FROM clothes
		WHERE user_id=$1 AND tags IS NOT NULL`, uid)
	if err != nil {
		return []tagCount{}
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil || len(raw) == 0 {
			continue
		}
		var tags []string
		if err := json.Unmarshal(raw, &tags); err != nil {
			continue
		}
		for _, t := range tags {
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			counts[t]++
		}
	}

	out := make([]tagCount, 0, len(counts))
	for name, n := range counts {
		out = append(out, tagCount{Name: name, Count: n})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func (TagsHandler) Create(c *gin.Context) {
	uid := middleware.UserID(c)
	var body struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		response.Fail(c, "标签名不能为空", 1, http.StatusOK)
		return
	}
	var id int64
	err := db.Pool.QueryRow(c, `
		INSERT INTO tags (user_id, name) VALUES ($1,$2)
		RETURNING id`, uid, name).Scan(&id)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, gin.H{"id": id, "name": name})
}

func (TagsHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	id := c.Param("id")
	_, err := db.Pool.Exec(c, `
		UPDATE tags SET deleted_at=NOW()
		WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, id, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, true)
}
