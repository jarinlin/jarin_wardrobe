const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')
const { ok } = require('../utils/response')

const router = express.Router()
router.use(authRequired)

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT name FROM tags
     WHERE user_id = :userId AND deleted_at IS NULL
     ORDER BY id ASC`,
    { userId: req.user.userId }
  )
  if (rows.length) return ok(res, rows.map((r) => r.name))

  // 无自定义标签时返回默认建议
  return ok(res, ['通勤', '运动', '聚会', '夏季', '秋冬'])
})

module.exports = router
