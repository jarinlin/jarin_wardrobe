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

async function attachClothes(outfit) {
  if (!outfit) return null
  const items = await query(
    `SELECT c.id, c.name, c.color, c.brand, c.image_url AS "imageUrl",
            cat.name AS "categoryName"
     FROM outfit_items oi
     JOIN clothes c ON c.id = oi.clothing_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE oi.outfit_id = :outfitId`,
    { outfitId: outfit.id }
  )
  return {
    id: outfit.id,
    date: formatDate(outfit.outfit_date),
    note: outfit.note,
    imageUrl: outfit.image_url,
    wearCount: outfit.wear_count,
    clothingIds: items.map((i) => i.id),
    clothes: items
  }
}

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT * FROM outfits
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY outfit_date DESC, id DESC`,
    { userId: req.user.userId }
  )
  const list = []
  for (const row of rows) list.push(await attachClothes(row))
  return ok(res, list)
})

router.get('/today', async (req, res) => {
  const date = req.query.date
  if (!date) return fail(res, '缺少 date')
  const rows = await query(
    `SELECT * FROM outfits
     WHERE user_id = :userId AND outfit_date = CAST(:date AS date) AND deleted_at IS NULL
     LIMIT 1`,
    { userId: req.user.userId, date }
  )
  return ok(res, await attachClothes(rows[0] || null))
})

router.get('/:id', async (req, res) => {
  const rows = await query(
    `SELECT * FROM outfits
     WHERE id = :id AND user_id = :userId AND deleted_at IS NULL
     LIMIT 1`,
    { id: req.params.id, userId: req.user.userId }
  )
  if (!rows[0]) return fail(res, '记录不存在', 404, 404)
  return ok(res, await attachClothes(rows[0]))
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  const date = b.date
  const clothingIds = Array.isArray(b.clothingIds) ? b.clothingIds : []
  if (!date) return fail(res, '缺少日期')
  if (!clothingIds.length) return fail(res, '请选择衣物')

  const existing = await query(
    `SELECT * FROM outfits
     WHERE user_id = :userId AND outfit_date = CAST(:date AS date) AND deleted_at IS NULL
     LIMIT 1`,
    { userId: req.user.userId, date }
  )

  let outfitId
  if (existing[0]) {
    outfitId = existing[0].id
    await query(
      `UPDATE outfits SET note = :note, image_url = :imageUrl, wear_count = wear_count + 1
       WHERE id = :id`,
      { id: outfitId, note: b.note || '', imageUrl: b.imageUrl || '' }
    )
    await query('DELETE FROM outfit_items WHERE outfit_id = :id', { id: outfitId })
  } else {
    const inserted = await query(
      `INSERT INTO outfits (user_id, outfit_date, note, image_url, wear_count)
       VALUES (:userId, CAST(:date AS date), :note, :imageUrl, 1)
       RETURNING id`,
      {
        userId: req.user.userId,
        date,
        note: b.note || '',
        imageUrl: b.imageUrl || ''
      }
    )
    outfitId = inserted[0].id
  }

  for (const clothingId of clothingIds) {
    await query(
      `INSERT INTO outfit_items (outfit_id, clothing_id) VALUES (:outfitId, :clothingId)`,
      { outfitId, clothingId }
    )
    await query(
      `UPDATE clothes SET wear_count = wear_count + 1
       WHERE id = :clothingId AND user_id = :userId`,
      { clothingId, userId: req.user.userId }
    )
  }

  const rows = await query('SELECT * FROM outfits WHERE id = :id', { id: outfitId })
  return ok(res, await attachClothes(rows[0]))
})

router.delete('/:id', async (req, res) => {
  await query(
    `UPDATE outfits SET deleted_at = NOW()
     WHERE id = :id AND user_id = :userId`,
    { id: req.params.id, userId: req.user.userId }
  )
  return ok(res, true)
})

module.exports = router
