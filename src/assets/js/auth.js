const TOKEN_KEY = 'jarin_token'
const USER_KEY = 'jarin_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '')
}

function getUserInfo() {
  return sanitizeUser(wx.getStorageSync(USER_KEY) || null)
}

function setUserInfo(user) {
  wx.setStorageSync(USER_KEY, sanitizeUser(user) || null)
}

/** 本机/临时头像不能给 <image> 当 src */
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user
  const url = String(user.avatarUrl || '')
  if (
    /127\.0\.0\.1|localhost|\[::1\]/i.test(url) ||
    /^https?:\/\/tmp/i.test(url) ||
    url.indexOf('wxfile://') === 0
  ) {
    return Object.assign({}, user, { avatarUrl: '' })
  }
  return user
}

function clear() {
  // 只清登录态，保留本地 user 资料，便于再次登录页预填昵称/头像
  wx.removeStorageSync(TOKEN_KEY)
}

function isLoggedIn() {
  return !!getToken()
}

let loginRedirecting = false

function isLoginPage() {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    return !!(cur && cur.route === 'pages/login/login')
  } catch (e) {
    return false
  }
}

/** 未登录则整页进入登录，不能返回空首页。已在登录页时不重复跳。 */
function requireLogin() {
  if (isLoggedIn()) {
    loginRedirecting = false
    return true
  }
  if (isLoginPage() || loginRedirecting) return false
  loginRedirecting = true
  wx.reLaunch({
    url: '/pages/login/login',
    complete() {
      loginRedirecting = false
    }
  })
  return false
}

/** 切到真实后端时，清掉以前 Mock 留下的假 token / openid */
function purgeStaleMockSession(useMock) {
  if (useMock) return false
  const token = getToken()
  const user = getUserInfo()
  const staleToken = typeof token === 'string' && token.indexOf('mock_token_') === 0
  const staleUser = user && String(user.openid || '').indexOf('mock_') === 0
  if (staleToken || staleUser) {
    wx.removeStorageSync(TOKEN_KEY)
    wx.removeStorageSync(USER_KEY)
    return true
  }
  return false
}

module.exports = {
  getToken,
  setToken,
  getUserInfo,
  setUserInfo,
  clear,
  isLoggedIn,
  requireLogin,
  purgeStaleMockSession
}
