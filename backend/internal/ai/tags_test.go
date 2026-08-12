package ai

import "testing"

func TestNormalizeTagList(t *testing.T) {
	got := normalizeTagList([]string{" 休闲 ", "", "春夏", "休闲"})
	if len(got) != 2 || got[0] != "休闲" || got[1] != "春夏" {
		t.Fatalf("%v", got)
	}
}
