const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')

const router = express.Router()
router.use(authRequired)

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT id, name, sort_order AS sort
     FROM categories
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
    { userId: req.user.userId }
  )
  return ok(res, rows)
})

router.post('/', async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim()
  if (!name) return fail(res, '分类名不能为空')

  const countRows = await query(
    'SELECT COUNT(*)::int AS c FROM categories WHERE user_id = :userId AND deleted_at IS NULL',
    { userId: req.user.userId }
  )
  const sort = Number(countRows[0].c) + 1
  const inserted = await query(
    `INSERT INTO categories (user_id, name, sort_order)
     VALUES (:userId, :name, :sort)
     RETURNING id`,
    { userId: req.user.userId, name, sort }
  )
  return ok(res, { id: inserted[0].id, name, sort })
})

router.put('/:id', async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim()
  if (!name) return fail(res, '分类名不能为空')
  await query(
    `UPDATE categories SET name = :name
     WHERE id = :id AND user_id = :userId AND deleted_at IS NULL`,
    { id: req.params.id, userId: req.user.userId, name }
  )
  return ok(res, { id: Number(req.params.id), name })
})

router.delete('/:id', async (req, res) => {
  await query(
    `UPDATE categories SET deleted_at = NOW()
     WHERE id = :id AND user_id = :userId`,
    { id: req.params.id, userId: req.user.userId }
  )
  return ok(res, true)
})

module.exports = router
