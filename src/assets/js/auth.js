const TOKEN_KEY = 'jarin_token'
const USER_KEY = 'jarin_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '')
}

function getUserInfo() {
  return wx.getStorageSync(USER_KEY) || null
}

function setUserInfo(user) {
  wx.setStorageSync(USER_KEY, user || null)
}

function clear() {
  // 只清登录态，保留本地 user 资料，便于再次登录页预填昵称/头像
  wx.removeStorageSync(TOKEN_KEY)
}

function isLoggedIn() {
  return !!getToken()
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
  purgeStaleMockSession
}
