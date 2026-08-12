package suggest

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

type WeatherInput struct {
	City        string
	Weather     string
	Temperature string
	TempC       float64
	HasWeather  bool
}

type Clothing struct {
	ID           int64
	Name         string
	CategoryID   int64
	CategoryName string
	Color        string
	ImageURL     string
	Tags         []string
	TagsStatus   string
	WearCount    int
}

type Item struct {
	ID           int64    `json:"id"`
	Name         string   `json:"name"`
	CategoryID   int64    `json:"categoryId"`
	CategoryName string   `json:"categoryName"`
	Color        string   `json:"color"`
	ImageURL     string   `json:"imageUrl"`
	Tags         []string `json:"tags"`
	Score        int      `json:"score"`
}

type Result struct {
	Items       []Item `json:"items"`
	Reason      string `json:"reason"`
	Tips        string `json:"tips"`
	SeasonHint  string `json:"seasonHint"`
	WeatherNote string `json:"weatherNote"`
}

type scored struct {
	c     Clothing
	score int
}

// BuildOutfit 按天气关键词对衣物 tags 打分，按分类去重取前若干件（规则引擎，可降级）。
func BuildOutfit(clothes []Clothing, weather WeatherInput) Result {
	season, prefer, avoid, tips := seasonProfile(weather)
	note := ""
	if !weather.HasWeather {
		note = "未能获取本地天气，已按当季常识推荐"
	}

	scoredList := make([]scored, 0, len(clothes))
	for _, c := range clothes {
		s := scoreClothing(c, prefer, avoid)
		if s <= 0 {
			continue
		}
		scoredList = append(scoredList, scored{c: c, score: s})
	}
	sort.SliceStable(scoredList, func(i, j int) bool {
		if scoredList[i].score != scoredList[j].score {
			return scoredList[i].score > scoredList[j].score
		}
		return scoredList[i].c.WearCount < scoredList[j].c.WearCount
	})

	picked := pickDiverse(scoredList, 6)
	items := make([]Item, 0, len(picked))
	for _, p := range picked {
		items = append(items, Item{
			ID:           p.c.ID,
			Name:         p.c.Name,
			CategoryID:   p.c.CategoryID,
			CategoryName: p.c.CategoryName,
			Color:        p.c.Color,
			ImageURL:     p.c.ImageURL,
			Tags:         p.c.Tags,
			Score:        p.score,
		})
	}

	reason := "根据衣柜标签匹配今日穿着"
	if weather.HasWeather {
		reason = fmt.Sprintf("%s %s℃ · %s，结合衣物标签挑选",
			weather.City, weather.Temperature, weather.Weather)
		if weather.City == "" {
			reason = fmt.Sprintf("今日 %s℃ · %s，结合衣物标签挑选",
				weather.Temperature, weather.Weather)
		}
	}
	if len(items) == 0 {
		reason = "衣柜暂无可匹配衣物，先去添加并等待 AI 打标"
		if tips == "" {
			tips = "建议先为衣物拍照保存，系统会异步生成穿搭标签"
		}
	}

	return Result{
		Items:       items,
		Reason:      reason,
		Tips:        tips,
		SeasonHint:  season,
		WeatherNote: note,
	}
}

func seasonProfile(w WeatherInput) (season string, prefer, avoid []string, tips string) {
	temp := w.TempC
	if !w.HasWeather || (temp == 0 && w.Temperature == "") {
		// 无天气：用日历粗分（由调用方可不传；此处给通用四季标签）
		return "适中", []string{"四季", "通勤", "日常", "休闲"}, nil, "天气未知时优先舒适日常单品"
	}

	wx := w.Weather
	switch {
	case temp >= 28:
		season = "炎热"
		prefer = []string{"夏季", "春夏", "短袖", "短裤", "薄", "凉", "透气", "凉鞋", "裙"}
		avoid = []string{"羽绒", "厚", "毛衣", "秋冬", "大衣", "棉服"}
		tips = "高温注意透气与防晒，少叠穿"
	case temp >= 20:
		season = "温暖"
		prefer = []string{"春夏", "夏季", "薄", "衬衫", "休闲", "通勤", "日常"}
		avoid = []string{"羽绒", "厚外套", "棉服"}
		tips = "温度舒适，轻薄单品即可"
	case temp >= 12:
		season = "微凉"
		prefer = []string{"春秋", "外套", "薄外套", "长袖", "休闲", "通勤"}
		avoid = []string{"短裤", "凉鞋", "吊带"}
		tips = "早晚偏凉，建议准备薄外套"
	case temp >= 5:
		season = "偏冷"
		prefer = []string{"秋冬", "毛衣", "外套", "厚", "长裤", "靴子"}
		avoid = []string{"短袖", "短裤", "凉鞋", "吊带"}
		tips = "注意保暖，可叠穿针织与外套"
	default:
		season = "寒冷"
		prefer = []string{"秋冬", "冬季", "羽绒", "厚", "大衣", "棉服", "毛衣", "靴子"}
		avoid = []string{"短袖", "短裤", "薄", "凉鞋", "吊带"}
		tips = "低温优先保暖，减少裸露面积"
	}

	if strings.Contains(wx, "雨") || strings.Contains(wx, "雪") {
		prefer = append(prefer, "防水", "外套", "靴子", "深色")
		avoid = append(avoid, "帆布鞋", "浅色鞋")
		if strings.Contains(wx, "雪") {
			tips = "雨雪天注意防滑保暖"
		} else {
			tips = "有雨，优先防泼水外套与深色鞋"
		}
	}
	if strings.Contains(wx, "风") {
		prefer = append(prefer, "外套", "长袖")
	}
	return season, prefer, avoid, tips
}

func scoreClothing(c Clothing, prefer, avoid []string) int {
	tags := make([]string, 0, len(c.Tags)+3)
	for _, t := range c.Tags {
		tags = append(tags, strings.ToLower(strings.TrimSpace(t)))
	}
	tags = append(tags,
		strings.ToLower(c.Name),
		strings.ToLower(c.CategoryName),
		strings.ToLower(c.Color),
	)
	blob := strings.Join(tags, " ")

	score := 8
	if c.TagsStatus == "ready" && len(c.Tags) > 0 {
		score += 12
	} else if len(c.Tags) > 0 {
		score += 4
	}
	for _, p := range prefer {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" && strings.Contains(blob, p) {
			score += 10
		}
	}
	for _, a := range avoid {
		a = strings.ToLower(strings.TrimSpace(a))
		if a != "" && strings.Contains(blob, a) {
			score -= 14
		}
	}
	// 略微偏好少穿的，鼓励轮换
	score += int(math.Max(0, 6-float64(c.WearCount)/3))
	return score
}

func pickDiverse(list []scored, limit int) []scored {
	if limit <= 0 {
		limit = 6
	}
	usedCat := map[string]int{}
	out := make([]scored, 0, limit)
	for _, item := range list {
		cat := strings.TrimSpace(item.c.CategoryName)
		if cat == "" {
			cat = "_"
		}
		if usedCat[cat] >= 2 {
			continue
		}
		usedCat[cat]++
		out = append(out, item)
		if len(out) >= limit {
			break
		}
	}
	// 若分类约束过严导致不足，再补
	if len(out) < limit {
		seen := map[int64]bool{}
		for _, o := range out {
			seen[o.c.ID] = true
		}
		for _, item := range list {
			if seen[item.c.ID] {
				continue
			}
			out = append(out, item)
			if len(out) >= limit {
				break
			}
		}
	}
	return out
}
