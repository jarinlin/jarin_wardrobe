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
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
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
    clear()
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
