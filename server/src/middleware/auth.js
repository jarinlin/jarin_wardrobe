const jwt = require('jsonwebtoken')
const config = require('../config')

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ code: 401, message: '登录已失效' })
  }
}

module.exports = {
  authRequired
}
