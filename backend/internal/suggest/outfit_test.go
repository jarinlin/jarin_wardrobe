package suggest

import "testing"

func TestBuildOutfitHotPrefersSummer(t *testing.T) {
	clothes := []Clothing{
		{ID: 1, Name: "白T", CategoryName: "上衣", Tags: []string{"夏季", "短袖", "休闲"}, TagsStatus: "ready"},
		{ID: 2, Name: "羽绒", CategoryName: "外套", Tags: []string{"秋冬", "羽绒", "厚"}, TagsStatus: "ready"},
		{ID: 3, Name: "短裤", CategoryName: "裤装", Tags: []string{"夏季", "短裤"}, TagsStatus: "ready"},
	}
	res := BuildOutfit(clothes, WeatherInput{
		City: "上海", Weather: "晴", Temperature: "32", TempC: 32, HasWeather: true,
	})
	if len(res.Items) == 0 {
		t.Fatal("expected items")
	}
	for _, it := range res.Items {
		if it.ID == 2 {
			t.Fatalf("should avoid down jacket in heat, got %#v", res.Items)
		}
	}
	if res.SeasonHint != "炎热" {
		t.Fatalf("season=%s", res.SeasonHint)
	}
}

func TestBuildOutfitDegradesWithoutWeather(t *testing.T) {
	clothes := []Clothing{
		{ID: 1, Name: "衬衫", CategoryName: "上衣", Tags: []string{"通勤", "日常"}, TagsStatus: "ready"},
	}
	res := BuildOutfit(clothes, WeatherInput{})
	if res.WeatherNote == "" {
		t.Fatal("expected weather note")
	}
	if len(res.Items) != 1 {
		t.Fatalf("items=%d", len(res.Items))
	}
}
