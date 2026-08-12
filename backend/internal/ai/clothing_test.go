package ai

import (
	"testing"
)

func TestStripJSONFence(t *testing.T) {
	raw := "```json\n{\"name\":\"白色T恤\",\"categoryName\":\"上衣\"}\n```"
	got := StripJSONFence(raw)
	if got != `{"name":"白色T恤","categoryName":"上衣"}` {
		t.Fatalf("unexpected: %q", got)
	}
}

func TestParseClothingJSON(t *testing.T) {
	raw := "```json\n{\"name\":\"牛仔裤\",\"categoryName\":\"裤装\",\"brand\":\"\",\"color\":\"蓝色\",\"size\":\"\",\"price\":199,\"priceEstimated\":true,\"priceNote\":\"估算\",\"confidence\":{\"category\":0.9,\"color\":0.8,\"brand\":0.1,\"size\":0.1,\"price\":0.4},\"rawTags\":[\"牛仔\"]}\n```"
	out, err := ParseClothingJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if out.Name != "牛仔裤" || out.CategoryName != "裤装" || !out.PriceEstimated {
		t.Fatalf("bad parse: %+v", out)
	}
	p, _ := out.Price.Float64()
	if p != 199 {
		t.Fatalf("price=%v", p)
	}
}

func TestMapCategory(t *testing.T) {
	cats := []Category{{ID: 1, Name: "上衣"}, {ID: 2, Name: "裤装"}}
	id, name := MapCategory("上衣", cats)
	if id == nil || *id != 1 || name != "上衣" {
		t.Fatalf("exact fail: %v %s", id, name)
	}
	id, name = MapCategory("休闲裤装", cats)
	if id == nil || *id != 2 {
		t.Fatalf("contains fail: %v %s", id, name)
	}
	id, name = MapCategory("帽子", cats)
	if id != nil || name != "帽子" {
		t.Fatalf("unmapped fail: %v %s", id, name)
	}
}
