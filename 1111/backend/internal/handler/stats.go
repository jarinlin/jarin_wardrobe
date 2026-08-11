package handler

import (
	"net/http"

	"jarin-wardrobe/internal/db"
	"jarin-wardrobe/internal/middleware"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct{}

func (StatsHandler) Get(c *gin.Context) {
	uid := middleware.UserID(c)
	var total int
	var value float64
	_ = db.Pool.QueryRow(c, `
		SELECT COUNT(*)::int, COALESCE(SUM(price),0)::float8
		FROM clothes WHERE user_id=$1 AND deleted_at IS NULL`, uid,
	).Scan(&total, &value)

	var most gin.H
	var mid int64
	var mname string
	var mwear int
	err := db.Pool.QueryRow(c, `
		SELECT id, name, wear_count FROM clothes
		WHERE user_id=$1 AND deleted_at IS NULL
		ORDER BY wear_count DESC, id DESC LIMIT 1`, uid,
	).Scan(&mid, &mname, &mwear)
	if err == nil {
		most = gin.H{"id": mid, "name": mname, "wearCount": mwear}
	}

	var least gin.H
	var lid int64
	var lname string
	var lwear int
	err = db.Pool.QueryRow(c, `
		SELECT id, name, wear_count FROM clothes
		WHERE user_id=$1 AND deleted_at IS NULL
		ORDER BY wear_count ASC, id ASC LIMIT 1`, uid,
	).Scan(&lid, &lname, &lwear)
	if err == nil {
		least = gin.H{"id": lid, "name": lname, "wearCount": lwear}
	}

	rows, err := db.Pool.Query(c, `
		SELECT id, name, created_at FROM clothes
		WHERE user_id=$1 AND deleted_at IS NULL
		ORDER BY created_at DESC LIMIT 3`, uid)
	recent := make([]gin.H, 0)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var name string
			var created any
			if err := rows.Scan(&id, &name, &created); err == nil {
				recent = append(recent, gin.H{"id": id, "name": name, "createdAt": created})
			}
		}
	}

	response.OK(c, gin.H{
		"total":     total,
		"value":     value,
		"mostWorn":  most,
		"leastWorn": least,
		"recent":    recent,
	})
}

func (StatsHandler) Tags(c *gin.Context) {
	uid := middleware.UserID(c)
	rows, err := db.Pool.Query(c, `
		SELECT name FROM tags WHERE user_id=$1 AND deleted_at IS NULL ORDER BY id ASC`, uid)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	defer rows.Close()
	list := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			list = append(list, name)
		}
	}
	if len(list) == 0 {
		list = []string{"通勤", "运动", "聚会", "夏季", "秋冬"}
	}
	response.OK(c, list)
}
