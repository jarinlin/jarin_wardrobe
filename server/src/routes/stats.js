const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')
const { ok } = require('../utils/response')

const router = express.Router()
router.use(authRequired)

router.get('/', async (req, res) => {
  const userId = req.user.userId
  const [summary] = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(price), 0) AS value
     FROM clothes WHERE user_id = :userId AND deleted_at IS NULL`,
    { userId }
  )
  const mostWornRows = await query(
    `SELECT id, name, wear_count AS wearCount
     FROM clothes
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY wear_count DESC, id DESC LIMIT 1`,
    { userId }
  )
  const leastWornRows = await query(
    `SELECT id, name, wear_count AS wearCount
     FROM clothes
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY wear_count ASC, id ASC LIMIT 1`,
    { userId }
  )
  const recent = await query(
    `SELECT id, name, created_at AS createdAt
     FROM clothes
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 3`,
    { userId }
  )

  return ok(res, {
    total: Number(summary.total || 0),
    value: Number(summary.value || 0),
    mostWorn: mostWornRows[0] || null,
    leastWorn: leastWornRows[0] || null,
    recent
  })
})

module.exports = router
