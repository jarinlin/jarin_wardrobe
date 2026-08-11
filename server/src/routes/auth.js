const express = require('express')
const jwt = require('jsonwebtoken')
const https = require('https')
const { query } = require('../db')
const config = require('../config')
const { ok, fail } = require('../utils/response')

const router = express.Router()

function code2Session(code) {
  return new Promise((resolve, reject) => {
    if (!config.wx.appId || !config.wx.secret) {
      if (config.allowMockLogin) {
        return resolve({ openid: `mock_${code || 'dev'}`, session_key: 'mock' })
      }
      return reject(new Error('未配置微信 AppID/Secret'))
    }
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${config.wx.appId}&secret=${config.wx.secret}` +
      `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`

    https
      .get(url, (resp) => {
        let raw = ''
        resp.on('data', (chunk) => (raw += chunk))
        resp.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (data.errcode) reject(new Error(data.errmsg || '微信登录失败'))
            else resolve(data)
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

router.post('/login', async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body || {}
    if (!code && !config.allowMockLogin) {
      return fail(res, '缺少 code')
    }

    const session = await code2Session(code || 'mock_code')
    const openid = session.openid

    let users = await query('SELECT * FROM users WHERE openid = :openid LIMIT 1', { openid })
    let user = users[0]

    if (!user) {
      const inserted = await query(
        `INSERT INTO users (openid, nickname, avatar_url)
         VALUES (:openid, :nickname, :avatarUrl)
         RETURNING id`,
        {
          openid,
          nickname: nickName || 'Jarin',
          avatarUrl: avatarUrl || ''
        }
      )
      const userId = inserted[0].id

      const defaults = ['上衣', '裤装', '外套', '鞋子', '包', '配饰']
      for (let i = 0; i < defaults.length; i++) {
        await query(
          `INSERT INTO categories (user_id, name, sort_order)
           VALUES (:userId, :name, :sort)`,
          { userId, name: defaults[i], sort: i + 1 }
        )
      }

      users = await query('SELECT * FROM users WHERE id = :id', { id: userId })
      user = users[0]
    } else if (nickName || avatarUrl) {
      await query(
        `UPDATE users SET nickname = COALESCE(:nickname, nickname),
         avatar_url = COALESCE(:avatarUrl, avatar_url)
         WHERE id = :id`,
        {
          id: user.id,
          nickname: nickName || null,
          avatarUrl: avatarUrl || null
        }
      )
      users = await query('SELECT * FROM users WHERE id = :id', { id: user.id })
      user = users[0]
    }

    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      config.jwtSecret,
      { expiresIn: '30d' }
    )

    return ok(res, {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        openid: user.openid
      }
    })
  } catch (e) {
    console.error(e)
    return fail(res, e.message || '登录失败')
  }
})

module.exports = router
