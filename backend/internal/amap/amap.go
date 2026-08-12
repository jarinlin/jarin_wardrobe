package amap

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	Key        string
	HTTPClient *http.Client
}

func New(key string) *Client {
	return &Client{
		Key: strings.TrimSpace(key),
		HTTPClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.Key != ""
}

type Weather struct {
	City        string  `json:"city"`
	Adcode      string  `json:"adcode"`
	Province    string  `json:"province"`
	Weather     string  `json:"weather"`
	Temperature string  `json:"temperature"`
	TempC       float64 `json:"tempC"`
	Humidity    string  `json:"humidity"`
	WindDirection string `json:"windDirection"`
	WindPower   string  `json:"windPower"`
	ReportTime  string  `json:"reportTime"`
}

type regeoResp struct {
	Status    string `json:"status"`
	Info      string `json:"info"`
	Regeocode struct {
		AddressComponent struct {
			Province string          `json:"province"`
			City     json.RawMessage `json:"city"`
			District string          `json:"district"`
			Adcode   string          `json:"adcode"`
		} `json:"addressComponent"`
	} `json:"regeocode"`
}

type weatherResp struct {
	Status   string `json:"status"`
	Info     string `json:"info"`
	Lives    []struct {
		Province      string `json:"province"`
		City          string `json:"city"`
		Adcode        string `json:"adcode"`
		Weather       string `json:"weather"`
		Temperature   string `json:"temperature"`
		Humidity      string `json:"humidity"`
		WindDirection string `json:"winddirection"`
		WindPower     string `json:"windpower"`
		ReportTime    string `json:"reporttime"`
	} `json:"lives"`
}

// WeatherByCoord 模糊坐标 → 城市 adcode → 实况天气
func (c *Client) WeatherByCoord(ctx context.Context, lat, lng float64) (*Weather, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("未配置 AMAP_KEY")
	}
	if lat == 0 && lng == 0 {
		return nil, fmt.Errorf("缺少坐标")
	}

	adcode, city, province, err := c.regeo(ctx, lat, lng)
	if err != nil {
		return nil, err
	}
	w, err := c.liveWeather(ctx, adcode)
	if err != nil {
		return nil, err
	}
	if w.City == "" {
		w.City = city
	}
	if w.Province == "" {
		w.Province = province
	}
	if w.Adcode == "" {
		w.Adcode = adcode
	}
	return w, nil
}

func (c *Client) regeo(ctx context.Context, lat, lng float64) (adcode, city, province string, err error) {
	q := url.Values{}
	q.Set("key", c.Key)
	q.Set("location", fmt.Sprintf("%.6f,%.6f", lng, lat)) // 高德：经度,纬度
	q.Set("extensions", "base")
	q.Set("radius", "1000")

	raw, err := c.get(ctx, "https://restapi.amap.com/v3/geocode/regeo?"+q.Encode())
	if err != nil {
		return "", "", "", err
	}
	var parsed regeoResp
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", "", "", err
	}
	if parsed.Status != "1" {
		return "", "", "", fmt.Errorf("高德逆地理失败: %s", parsed.Info)
	}
	ac := parsed.Regeocode.AddressComponent
	city = decodeCity(ac.City)
	if city == "" {
		city = ac.District
	}
	if city == "" {
		city = ac.Province
	}
	return ac.Adcode, city, ac.Province, nil
}

func (c *Client) liveWeather(ctx context.Context, cityOrAdcode string) (*Weather, error) {
	if strings.TrimSpace(cityOrAdcode) == "" {
		return nil, fmt.Errorf("缺少城市编码")
	}
	q := url.Values{}
	q.Set("key", c.Key)
	q.Set("city", cityOrAdcode)
	q.Set("extensions", "base")

	raw, err := c.get(ctx, "https://restapi.amap.com/v3/weather/weatherInfo?"+q.Encode())
	if err != nil {
		return nil, err
	}
	var parsed weatherResp
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	if parsed.Status != "1" {
		return nil, fmt.Errorf("高德天气失败: %s", parsed.Info)
	}
	if len(parsed.Lives) == 0 {
		return nil, fmt.Errorf("无天气实况")
	}
	live := parsed.Lives[0]
	tempC, _ := strconv.ParseFloat(live.Temperature, 64)
	return &Weather{
		City:          live.City,
		Adcode:        live.Adcode,
		Province:      live.Province,
		Weather:       live.Weather,
		Temperature:   live.Temperature,
		TempC:         tempC,
		Humidity:      live.Humidity,
		WindDirection: live.WindDirection,
		WindPower:     live.WindPower,
		ReportTime:    live.ReportTime,
	}, nil
}

func (c *Client) get(ctx context.Context, fullURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("高德 HTTP %d", resp.StatusCode)
	}
	return raw, nil
}

// 高德 city 字段在直辖市可能是 []，区县可能是 string
func decodeCity(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "[]" || string(raw) == "null" {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return strings.TrimSpace(s)
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return strings.TrimSpace(arr[0])
	}
	return ""
}
