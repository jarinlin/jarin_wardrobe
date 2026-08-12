package db

import (
	"context"
	"log"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  openid        VARCHAR(64)  NOT NULL,
  nickname      VARCHAR(64)  NOT NULL DEFAULT '',
  avatar_url    VARCHAR(512) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_users_openid UNIQUE (openid)
);

CREATE TABLE IF NOT EXISTS categories (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT       NOT NULL REFERENCES users(id),
  name          VARCHAR(32)  NOT NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

CREATE TABLE IF NOT EXISTS clothes (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT         NOT NULL REFERENCES users(id),
  category_id   BIGINT         NOT NULL REFERENCES categories(id),
  name          VARCHAR(64)    NOT NULL,
  brand         VARCHAR(64)    NOT NULL DEFAULT '',
  color         VARCHAR(32)    NOT NULL DEFAULT '',
  size          VARCHAR(32)    NOT NULL DEFAULT '',
  buy_date      DATE           NULL,
  price         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  wear_count    INT            NOT NULL DEFAULT 0,
  remark        VARCHAR(500)   NOT NULL DEFAULT '',
  image_url     VARCHAR(512)   NOT NULL DEFAULT '',
  tags          JSONB          NULL,
  tags_status   VARCHAR(16)    NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ    NULL
);
CREATE INDEX IF NOT EXISTS idx_clothes_user_cat ON clothes(user_id, category_id);

CREATE TABLE IF NOT EXISTS outfits (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT       NOT NULL REFERENCES users(id),
  outfit_date   DATE         NOT NULL,
  note          VARCHAR(255) NOT NULL DEFAULT '',
  image_url     VARCHAR(512) NOT NULL DEFAULT '',
  wear_count    INT          NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_outfits_user_date
  ON outfits(user_id, outfit_date)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS outfit_items (
  id            BIGSERIAL PRIMARY KEY,
  outfit_id     BIGINT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_id   BIGINT NOT NULL REFERENCES clothes(id)
);
CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX IF NOT EXISTS idx_outfit_items_clothing ON outfit_items(clothing_id);

CREATE TABLE IF NOT EXISTS tags (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id),
  name          VARCHAR(32) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

CREATE TABLE IF NOT EXISTS user_body_profiles (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gender     VARCHAR(16) NOT NULL DEFAULT '',
  age        INT NOT NULL DEFAULT 0,
  height_cm  NUMERIC(5,1) NOT NULL DEFAULT 0,
  weight_kg  NUMERIC(5,1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diet_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type  VARCHAR(16) NOT NULL,
  meal_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_url  VARCHAR(512) NOT NULL DEFAULT '',
  food_name  VARCHAR(128) NOT NULL DEFAULT '',
  portion    VARCHAR(64) NOT NULL DEFAULT '',
  calories   NUMERIC(8,1) NOT NULL DEFAULT 0,
  advice     VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_meal ON diet_logs(user_id, meal_at DESC);
`

// 仅补齐缺失列，不做数据硬删
const alterSQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothes' AND column_name='tags_status'
  ) THEN
    ALTER TABLE clothes ADD COLUMN tags_status VARCHAR(16) NOT NULL DEFAULT '';
  END IF;
END $$;
`

func ensureTables(ctx context.Context) error {
	if _, err := Pool.Exec(ctx, schemaSQL); err != nil {
		return err
	}
	if _, err := Pool.Exec(ctx, alterSQL); err != nil {
		return err
	}
	log.Println("[db] 数据表已就绪（含身体档案/饮食/tags_status）")
	return nil
}
