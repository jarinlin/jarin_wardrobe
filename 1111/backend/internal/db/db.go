package db

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"time"

	"jarin-wardrobe/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect(cfg config.Config) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := ensureDatabase(ctx, cfg); err != nil {
		log.Printf("[db] 自动建库跳过: %v", err)
	}

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL(cfg.DBName))
	if err != nil {
		return err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return err
	}
	Pool = pool
	return ensureTables(ctx)
}

func ensureDatabase(ctx context.Context, cfg config.Config) error {
	name := cfg.DBName
	if !regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`).MatchString(name) {
		return fmt.Errorf("非法数据库名")
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL(cfg.DBAdminDatabase))
	if err != nil {
		return err
	}
	defer pool.Close()

	var exists bool
	if err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1)", name).Scan(&exists); err != nil {
		return err
	}
	if exists {
		log.Printf("[db] 数据库已存在: %s", name)
		return nil
	}
	_, err = pool.Exec(ctx, "CREATE DATABASE "+name)
	if err != nil {
		return err
	}
	log.Printf("[db] 已创建数据库: %s", name)
	return nil
}

func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
