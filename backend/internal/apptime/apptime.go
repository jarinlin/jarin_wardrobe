package apptime

import (
	"sync"
	"time"
)

const ZoneName = "Asia/Shanghai"

var (
	once sync.Once
	loc  *time.Location
)

// Loc 返回 Asia/Shanghai；失败时回退 FixedZone UTC+8。
func Loc() *time.Location {
	once.Do(func() {
		l, err := time.LoadLocation(ZoneName)
		if err != nil {
			l = time.FixedZone("CST", 8*3600)
		}
		loc = l
	})
	return loc
}

// Init 将进程本地时区设为上海，保证 time.Now / time.Local 一致。
func Init() {
	time.Local = Loc()
}

func Now() time.Time {
	return time.Now().In(Loc())
}

func In(t time.Time) time.Time {
	if t.IsZero() {
		return t
	}
	return t.In(Loc())
}

func FormatRFC3339(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return In(t).Format(time.RFC3339)
}

func FormatDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return In(t).Format("2006-01-02")
}
