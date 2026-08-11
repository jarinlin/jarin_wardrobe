package handler

import (
	"net/http"
	"strings"

	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type CategoriesHandler struct{}

func (CategoriesHandler) List(c *gin.Context) {
	uid := middleware.UserID(c)
	rows, err := db.Pool.Query(c, `
		SELECT id, name, sort_order
		FROM categories
		WHERE user_id=$1 AND deleted_at IS NULL
		ORDER BY sort_order ASC, id ASC`, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()
	list := make([]gin.H, 0)
	for rows.Next() {
		var id int64
		var name string
		var sort int
		if err := rows.Scan(&id, &name, &sort); err != nil {
			response.Fail(c, err.Error(), 1, http.StatusOK)
			return
		}
		list = append(list, gin.H{"id": id, "name": name, "sort": sort})
	}
	response.OK(c, list)
}

func (CategoriesHandler) Create(c *gin.Context) {
	uid := middleware.UserID(c)
	var body struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		response.Fail(c, "分类名不能为空", 1, http.StatusOK)
		return
	}
	var count int
	_ = db.Pool.QueryRow(c, `SELECT COUNT(*)::int FROM categories WHERE user_id=$1 AND deleted_at IS NULL`, uid).Scan(&count)
	sort := count + 1
	var id int64
	err := db.Pool.QueryRow(c,
		`INSERT INTO categories (user_id, name, sort_order) VALUES ($1,$2,$3) RETURNING id`,
		uid, name, sort,
	).Scan(&id)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, gin.H{"id": id, "name": name, "sort": sort})
}

func (CategoriesHandler) Update(c *gin.Context) {
	uid := middleware.UserID(c)
	var body struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		response.Fail(c, "分类名不能为空", 1, http.StatusOK)
		return
	}
	_, err := db.Pool.Exec(c,
		`UPDATE categories SET name=$1 WHERE id=$2 AND user_id=$3 AND deleted_at IS NULL`,
		name, c.Param("id"), uid,
	)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, gin.H{"id": c.Param("id"), "name": name})
}

func (CategoriesHandler) Delete(c *gin.Context) {
	uid := middleware.UserID(c)
	_, err := db.Pool.Exec(c,
		`UPDATE categories SET deleted_at=NOW() WHERE id=$1 AND user_id=$2`,
		c.Param("id"), uid,
	)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, true)
}
