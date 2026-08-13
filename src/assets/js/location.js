/**
 * 模糊定位（城市级），用于天气与穿搭建议。
 * 隐私：requirePrivacyAuthorize 失败仍继续 getFuzzyLocation，
 * 以便触发微信官方隐私弹窗（勿因预检失败直接放弃）。
 *
 * @param {{ forceOpenSetting?: boolean }} [opts]
 * @returns {Promise<{ lat: number, lng: number } | { error: string, message: string }>}
 */

const util = require('./util')

/** 开发者工具模拟器常用拿不到 getFuzzyLocation，用广州坐标方便联调天气 */
const DEVTOOLS_FALLBACK = { lat: 23.129163, lng: 113.264435 }

function isDevtools() {
  try {
    const info = wx.getSystemInfoSync()
    return info && info.platform === 'devtools'
  } catch (e) {
    return false
  }
}

function getFuzzyLocation(opts) {
  const forceOpenSetting = !!(opts && opts.forceOpenSetting)

  return new Promise((resolve) => {
    const ok = (lat, lng) => {
      const latN = Number(lat)
      const lngN = Number(lng)
      if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
        console.warn('[location] fuzzy 结果无效', lat, lng)
        resolve({ error: 'invalid', message: '定位结果无效' })
        return
      }
      console.log('[location] fuzzy ok', latN, lngN)
      try {
        wx.setStorageSync('last_fuzzy_location', { lat: latN, lng: lngN, at: Date.now() })
      } catch (e) {}
      resolve({ lat: latN, lng: lngN })
    }

    const fail = (err, code, message) => {
      const msg = (err && (err.errMsg || err.message)) || message || '定位失败'
      console.warn('[location] fuzzy fail', code || 'fail', err)
      if (isDevtools()) {
        console.warn('[location] 模拟器定位不可用，使用广州坐标联调天气', DEVTOOLS_FALLBACK)
        ok(DEVTOOLS_FALLBACK.lat, DEVTOOLS_FALLBACK.lng)
        return
      }
      resolve({ error: code || 'fail', message: msg })
    }

    const requestLoc = () => {
      if (!wx.getFuzzyLocation) {
        fail(null, 'unsupported', '当前基础库不支持模糊定位，请升级微信')
        return
      }
      wx.getFuzzyLocation({
        type: 'gcj02',
        success(res) {
          ok(res.latitude, res.longitude)
        },
        fail(err) {
          const kind = util.classifyMediaErr(err)
          if (kind === 'privacy_undeclared') {
            fail(err, 'privacy', '隐私指引未声明位置，请后台勾选「位置信息」并发布')
            return
          }
          if (kind === 'privacy') {
            fail(err, 'privacy', '请先同意隐私指引中的位置说明')
            return
          }
          if (kind === 'denied') {
            fail(err, 'denied', '需要授权模糊位置才能获取当地天气')
            return
          }
          fail(err, 'fail', '获取模糊位置失败')
        }
      })
    }

    const ensureAuthThenLocate = () => {
      wx.getSetting({
        success(setting) {
          const authed = setting.authSetting && setting.authSetting['scope.userFuzzyLocation']
          if (authed === true) {
            requestLoc()
            return
          }
          if (authed === false) {
            if (isDevtools()) {
              fail(null, 'devtools', '模拟器未授权模糊位置')
              return
            }
            if (forceOpenSetting) {
              wx.showModal({
                title: '需要位置权限',
                content: '请在设置中开启「模糊位置」，用于查询当地天气并给出穿搭建议',
                confirmText: '去设置',
                success(r) {
                  if (!r.confirm) {
                    fail(null, 'denied', '已取消开启定位')
                    return
                  }
                  wx.openSetting({
                    success(res) {
                      if (res.authSetting && res.authSetting['scope.userFuzzyLocation']) {
                        requestLoc()
                      } else {
                        fail(null, 'denied', '未开启模糊位置权限')
                      }
                    },
                    fail: (e) => fail(e, 'denied', '打开设置失败')
                  })
                }
              })
              return
            }
            fail(null, 'denied', '未开启模糊位置权限，点「刷新」可去设置开启')
            return
          }
          // 未询问过：authorize 会弹系统授权窗
          wx.authorize({
            scope: 'scope.userFuzzyLocation',
            success: requestLoc,
            fail() {
              // 部分基础库 authorize 不弹窗，直接调接口再触发官方弹窗
              requestLoc()
            }
          })
        },
        fail() {
          requestLoc()
        }
      })
    }

    // 隐私预检失败仍继续，避免「完全不弹窗」
    util
      .requirePrivacyAuthorize({ continueOnFail: true })
      .then(ensureAuthThenLocate)
      .catch(ensureAuthThenLocate)
  })
}

function isLocationOk(loc) {
  return !!(loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng)))
}

function lastFuzzyLocation() {
  try {
    const saved = wx.getStorageSync('last_fuzzy_location')
    if (saved && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lng))) {
      return { lat: Number(saved.lat), lng: Number(saved.lng) }
    }
  } catch (e) {}
  return null
}

module.exports = {
  getFuzzyLocation,
  isLocationOk,
  lastFuzzyLocation
}
