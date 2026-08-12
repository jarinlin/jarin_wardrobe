package handler

import (
	"net/http"
	"strconv"

	"jarin-wardrobe/internal/amap"
	"jarin-wardrobe/internal/response"

	"github.com/gin-gonic/gin"
)

type WeatherHandler struct {
	Amap *amap.Client
}

func (h WeatherHandler) Get(c *gin.Context) {
	if h.Amap == nil || !h.Amap.Enabled() {
		response.Fail(c, "未配置高德 Key（AMAP_KEY）", 1, http.StatusOK)
		return
	}
	lat, lng, err := parseLatLng(c)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	w, err := h.Amap.WeatherByCoord(c.Request.Context(), lat, lng)
	if err != nil {
		response.Fail(c, err.Error(), 1, http.StatusOK)
		return
	}
	response.OK(c, w)
}

func parseLatLng(c *gin.Context) (float64, float64, error) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	if latStr == "" || lngStr == "" {
		return 0, 0, errMissingCoord
	}
	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		return 0, 0, errBadCoord
	}
	return lat, lng, nil
}

var (
	errMissingCoord = errStr("缺少 lat/lng")
	errBadCoord     = errStr("lat/lng 无效")
)

type errStr string

func (e errStr) Error() string { return string(e) }
