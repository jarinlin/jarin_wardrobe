const auth = require('./src/assets/js/auth')
const { BASE_URL } = require('./src/assets/js/config')

App({
  globalData: {
    userInfo: null,
    baseUrl: BASE_URL
  },

  onLaunch() {
    const token = auth.getToken()
    const userInfo = auth.getUserInfo()
    if (token && userInfo) {
      this.globalData.userInfo = userInfo
    }
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    auth.setUserInfo(userInfo)
  },

  clearSession() {
    this.globalData.userInfo = null
    auth.clear()
  }
})
