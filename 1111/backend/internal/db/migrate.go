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
`

func ensureTables(ctx context.Context) error {
	_, err := Pool.Exec(ctx, schemaSQL)
	if err != nil {
		return err
	}
	log.Println("[db] 数据表已就绪")
	return nil
}
