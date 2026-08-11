const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')

const router = express.Router()
router.use(authRequired)

function formatDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function parseTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') {
    try {
      return JSON.parse(tags)
    } catch (e) {
      return []
    }
  }
  return []
}

function mapClothing(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    brand: row.brand,
    color: row.color,
    size: row.size,
    buyDate: formatDate(row.buy_date),
    price: Number(row.price || 0),
    wearCount: row.wear_count,
    remark: row.remark,
    imageUrl: row.image_url,
    tags: parseTags(row.tags),
    createdAt: row.created_at
  }
}

router.get('/', async (req, res) => {
  const { categoryId, keyword } = req.query
  let sql = `
    SELECT c.*, cat.name AS category_name
    FROM clothes c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.user_id = :userId AND c.deleted_at IS NULL
  `
  const params = { userId: req.user.userId }
  if (categoryId) {
    sql += ' AND c.category_id = :categoryId'
    params.categoryId = categoryId
  }
  if (keyword) {
    sql += ` AND (c.name ILIKE :kw OR c.brand ILIKE :kw OR c.color ILIKE :kw)`
    params.kw = `%${keyword}%`
  }
  sql += ' ORDER BY c.id DESC'
  const rows = await query(sql, params)
  return ok(res, rows.map(mapClothing))
})

router.get('/:id', async (req, res) => {
  const rows = await query(
    `SELECT c.*, cat.name AS category_name
     FROM clothes c
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.id = :id AND c.user_id = :userId AND c.deleted_at IS NULL
     LIMIT 1`,
    { id: req.params.id, userId: req.user.userId }
  )
  if (!rows[0]) return fail(res, '衣物不存在', 404, 404)
  return ok(res, mapClothing(rows[0]))
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  if (!b.name || !b.categoryId) return fail(res, '名称和分类必填')

  const inserted = await query(
    `INSERT INTO clothes
      (user_id, category_id, name, brand, color, size, buy_date, price, wear_count, remark, image_url, tags)
     VALUES
      (:userId, :categoryId, :name, :brand, :color, :size, :buyDate, :price, :wearCount, :remark, :imageUrl, CAST(:tags AS jsonb))
     RETURNING id`,
    {
      userId: req.user.userId,
      categoryId: b.categoryId,
      name: String(b.name).trim(),
      brand: b.brand || '',
      color: b.color || '',
      size: b.size || '',
      buyDate: b.buyDate || null,
      price: Number(b.price || 0),
      wearCount: Number(b.wearCount || 0),
      remark: b.remark || '',
      imageUrl: b.imageUrl || '',
      tags: JSON.stringify(b.tags || [])
    }
  )
  const rows = await query(
    `SELECT c.*, cat.name AS category_name
     FROM clothes c
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.id = :id`,
    { id: inserted[0].id }
  )
  return ok(res, mapClothing(rows[0]))
})

router.put('/:id', async (req, res) => {
  const b = req.body || {}
  await query(
    `UPDATE clothes SET
      category_id = :categoryId,
      name = :name,
      brand = :brand,
      color = :color,
      size = :size,
      buy_date = :buyDate,
      price = :price,
      remark = :remark,
      image_url = :imageUrl,
      tags = CAST(:tags AS jsonb)
     WHERE id = :id AND user_id = :userId AND deleted_at IS NULL`,
    {
      id: req.params.id,
      userId: req.user.userId,
      categoryId: b.categoryId,
      name: String(b.name || '').trim(),
      brand: b.brand || '',
      color: b.color || '',
      size: b.size || '',
      buyDate: b.buyDate || null,
      price: Number(b.price || 0),
      remark: b.remark || '',
      imageUrl: b.imageUrl || '',
      tags: JSON.stringify(b.tags || [])
    }
  )
  const rows = await query(
    `SELECT c.*, cat.name AS category_name
     FROM clothes c
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.id = :id`,
    { id: req.params.id }
  )
  return ok(res, mapClothing(rows[0]))
})

router.delete('/:id', async (req, res) => {
  await query(
    `UPDATE clothes SET deleted_at = NOW()
     WHERE id = :id AND user_id = :userId`,
    { id: req.params.id, userId: req.user.userId }
  )
  return ok(res, true)
})

module.exports = router
