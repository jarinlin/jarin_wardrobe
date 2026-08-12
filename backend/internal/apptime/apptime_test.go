package apptime

import (
	"strings"
	"testing"
	"time"
)

func TestFormatRFC3339Shanghai(t *testing.T) {
	Init()
	utc := time.Date(2026, 8, 12, 3, 30, 0, 0, time.UTC)
	got := FormatRFC3339(utc)
	if !strings.HasPrefix(got, "2026-08-12T11:30:00") {
		t.Fatalf("want Shanghai 11:30, got %s", got)
	}
	if !strings.Contains(got, "+08:00") {
		t.Fatalf("want +08:00 offset, got %s", got)
	}
}
