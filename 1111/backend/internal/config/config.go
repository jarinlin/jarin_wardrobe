package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	JWTSecret       string
	DBHost          string
	DBPort          string
	DBUser          string
	DBPassword      string
	DBName          string
	DBAdminDatabase string
	WXAppID         string
	WXSecret        string
	AllowMockLogin  bool
}

func Load() Config {
	_ = godotenv.Load()
	return Config{
		Port:            getEnv("PORT", "3000"),
		JWTSecret:       getEnv("JWT_SECRET", "jarin_wardrobe_dev_secret"),
		DBHost:          getEnv("DB_HOST", "127.0.0.1"),
		DBPort:          getEnv("DB_PORT", "5432"),
		DBUser:          getEnv("DB_USER", "postgres"),
		DBPassword:      getEnv("DB_PASSWORD", ""),
		DBName:          getEnv("DB_NAME", "jarin_wardrobe"),
		DBAdminDatabase: getEnv("DB_ADMIN_DATABASE", "postgres"),
		WXAppID:         getEnv("WX_APPID", ""),
		WXSecret:        getEnv("WX_SECRET", ""),
		AllowMockLogin:  getEnvBool("ALLOW_MOCK_LOGIN", true),
	}
}

func (c Config) SSLMode() string {
	if c.DBHost == "127.0.0.1" || c.DBHost == "localhost" {
		return "disable"
	}
	return "require"
}

func (c Config) DatabaseURL(dbName string) string {
	u := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(c.DBUser, c.DBPassword),
		Host:   c.DBHost + ":" + c.DBPort,
		Path:   "/" + dbName,
	}
	q := u.Query()
	q.Set("sslmode", c.SSLMode())
	u.RawQuery = q.Encode()
	return u.String()
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
