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

module.exports = {
  getToken,
  setToken,
  getUserInfo,
  setUserInfo,
  clear,
  isLoggedIn
}
