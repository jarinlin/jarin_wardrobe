package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": data})
}

func Fail(c *gin.Context, message string, code int, httpStatus int) {
	if code == 0 {
		code = 1
	}
	if httpStatus == 0 {
		httpStatus = http.StatusOK
	}
	c.JSON(httpStatus, gin.H{"code": code, "message": message, "data": nil})
}
