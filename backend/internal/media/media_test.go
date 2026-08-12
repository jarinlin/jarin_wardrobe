package media

import (
	"strings"
	"testing"
	"time"

	"jarin-wardrobe/internal/config"
)

func testCfg() config.Config {
	return config.Config{
		Port:          "3000",
		PublicBaseURL: "http://127.0.0.1:3000",
		JWTSecret:     "test-secret",
		COSPrefix:     "wardrobe",
		COSBucket:     "bucket-125",
		COSRegion:     "ap-guangzhou",
	}
}

func TestExtractKey(t *testing.T) {
	cfg := testCfg()
	cases := []struct {
		in, want string
	}{
		{"wardrobe/1/2026/08/a.jpg", "wardrobe/1/2026/08/a.jpg"},
		{"http://127.0.0.1:3000/api/media/wardrobe/1/2026/08/a.jpg?u=1&exp=1&sig=x", "wardrobe/1/2026/08/a.jpg"},
		{"https://bucket-125.cos.ap-guangzhou.myqcloud.com/wardrobe/1/2026/08/a.jpg", "wardrobe/1/2026/08/a.jpg"},
		{"https://thirdwx.qlogo.cn/mmopen/vi_32/abc/132", ""}, // 外链不当作 COS key
	}
	for _, tc := range cases {
		got := ExtractKey(cfg, tc.in)
		if got != tc.want {
			t.Fatalf("ExtractKey(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestOwnsKeyEmptyPrefix(t *testing.T) {
	cfg := testCfg()
	cfg.COSPrefix = ""
	if !OwnsKey(cfg, "1/2026/08/a.jpg", 1) {
		t.Fatal("empty prefix should own userId/...")
	}
	if OwnsKey(cfg, "2/2026/08/a.jpg", 1) {
		t.Fatal("other user should fail")
	}
	u := ProxyURL(cfg, 1, "1/2026/08/a.jpg")
	if !strings.Contains(u, "/api/media/1/2026/08/a.jpg?") {
		t.Fatalf("bad proxy url: %s", u)
	}
}

func TestSignVerify(t *testing.T) {
	cfg := testCfg()
	key := "wardrobe/1/2026/08/a.jpg"
	exp, sig := Sign(cfg, 1, key, time.Hour)
	if !Verify(cfg, 1, key, exp, sig) {
		t.Fatal("verify failed")
	}
	if Verify(cfg, 2, key, exp, sig) {
		t.Fatal("other user should fail")
	}
}

func TestProxyURL(t *testing.T) {
	cfg := testCfg()
	u := ProxyURL(cfg, 1, "wardrobe/1/2026/08/a.jpg")
	if !strings.HasPrefix(u, "http://127.0.0.1:3000/api/media/wardrobe/1/2026/08/a.jpg?") {
		t.Fatalf("bad url: %s", u)
	}
	if !strings.Contains(u, "sig=") {
		t.Fatal("missing sig")
	}
}
