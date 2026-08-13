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

/**
 * 按当前时刻预选饮食餐次：
 * 7–9 早餐，11–13 午餐，18–21 晚餐，其余其他
 */
function guessMealType(date = new Date()) {
  const h = (date instanceof Date ? date : new Date()).getHours()
  if (h >= 7 && h <= 9) return 'breakfast'
  if (h >= 11 && h <= 13) return 'lunch'
  if (h >= 18 && h <= 21) return 'dinner'
  return 'other'
}

/** 按生日计算周岁年龄（本地日历日） */
function ageFromBirthDate(birthDate) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 0
  const [y, m, d] = birthDate.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  const month = now.getMonth() + 1
  const day = now.getDate()
  if (month < m || (month === m && day < d)) age -= 1
  if (age < 0) return 0
  if (age > 120) return 120
  return age
}

function formatPrice(n) {
  const num = Number(n) || 0
  return '¥' + num.toFixed(num % 1 === 0 ? 0 : 2)
}

function ensureLogin() {
  const auth = require('./auth')
  return auth.requireLogin()
}

/**
 * 分类隐私/选图/定位相关错误
 * @returns {'cancel'|'privacy'|'privacy_undeclared'|'denied'|'fail'}
 */
function classifyMediaErr(err) {
  if (!err) return 'fail'
  const errno = err.errno
  // 微信隐私 errno：103 拒绝官方弹窗；104 未同意；112 指引未声明该类型
  if (errno === 112) return 'privacy_undeclared'
  if (errno === 103 || errno === 104) return 'privacy'
  const msg = String((err && (err.errMsg || err.message)) || '')
  if (/not declared|scope is not declared|privacy api banned/i.test(msg)) {
    return 'privacy_undeclared'
  }
  if (/privacy|隐私/i.test(msg)) return 'privacy'
  // 隐私拒绝偶发带 cancel，不能当作用户取消选图
  if (/cancel/i.test(msg) && !/privacy|隐私/i.test(msg)) return 'cancel'
  if (/auth deny|authorize|permission|权限/i.test(msg)) return 'denied'
  return 'fail'
}

function isUserCancel(err) {
  return classifyMediaErr(err) === 'cancel'
}

function toastChooseImageFail(err) {
  const kind = classifyMediaErr(err)
  if (kind === 'cancel') return
  let title = '选图失败'
  if (kind === 'privacy_undeclared') {
    title = '隐私指引未声明照片，请后台勾选并发布'
  } else if (kind === 'privacy') {
    title = '请先同意隐私协议（相册/照片）'
  } else if (kind === 'denied') {
    title = '请允许使用相册/相机'
  }
  wx.showToast({ title, icon: 'none', duration: 2800 })
}

/**
 * 主动拉起隐私授权（选图/定位前调用）。
 * @param {{ continueOnFail?: boolean }} [opts]
 *   continueOnFail=true 时失败仍 resolve（定位场景：继续调接口触发官方弹窗）
 *   默认 false：失败 reject，便于选图明确提示
 */
function requirePrivacyAuthorize(opts) {
  const continueOnFail = !!(opts && opts.continueOnFail)
  return new Promise((resolve, reject) => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      resolve({ skipped: true })
      return
    }
    wx.requirePrivacyAuthorize({
      success() {
        resolve({ ok: true })
      },
      fail(err) {
        console.warn('[privacy] requirePrivacyAuthorize fail', err)
        if (continueOnFail) {
          resolve({ ok: false, err })
          return
        }
        reject(err || new Error('privacy authorize fail'))
      }
    })
  })
}

/** 选图（先隐私授权，再 prefer chooseMedia，失败回退 chooseImage）；非取消失败会 toast */
function chooseImage(count = 1) {
  return requirePrivacyAuthorize({ continueOnFail: false })
    .catch((err) => {
      toastChooseImageFail(err)
      return Promise.reject(err)
    })
    .then(
      () =>
        new Promise((resolve, reject) => {
          const onFail = (err) => {
            toastChooseImageFail(err)
            reject(err)
          }
          const onPaths = (paths) => {
            if (!paths || !paths.length) {
              const err = new Error('未选择图片')
              wx.showToast({ title: '未选择图片', icon: 'none' })
              reject(err)
              return
            }
            resolve(paths)
          }

          if (typeof wx.chooseMedia === 'function') {
            wx.chooseMedia({
              count,
              mediaType: ['image'],
              sourceType: ['album', 'camera'],
              success(res) {
                onPaths((res.tempFiles || []).map((f) => f.tempFilePath).filter(Boolean))
              },
              fail: onFail
            })
            return
          }

          wx.chooseImage({
            count,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success(res) {
              onPaths(res.tempFilePaths || [])
            },
            fail: onFail
          })
        })
    )
}

module.exports = {
  formatDate,
  formatDisplayDate,
  ageFromBirthDate,
  guessMealType,
  formatPrice,
  ensureLogin,
  chooseImage,
  isUserCancel,
  classifyMediaErr,
  requirePrivacyAuthorize,
  toastChooseImageFail
}
