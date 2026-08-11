function formatDate(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function formatPrice(n) {
  const num = Number(n) || 0
  return '¥' + num.toFixed(num % 1 === 0 ? 0 : 2)
}

function ensureLogin() {
  const auth = require('./auth')
  if (!auth.isLoggedIn()) {
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
  return true
}

function chooseImage(count = 1) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const paths = (res.tempFiles || []).map((f) => f.tempFilePath)
        resolve(paths)
      },
      fail: reject
    })
  })
}

module.exports = {
  formatDate,
  formatDisplayDate,
  formatPrice,
  ensureLogin,
  chooseImage
}
