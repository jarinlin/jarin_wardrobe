const auth = require('./src/assets/js/auth')
const { BASE_URL, USE_CLOUD, CLOUD_ENV } = require('./src/assets/js/config')
const { loadMiSans } = require('./src/assets/js/fonts')

App({
  globalData: {
    userInfo: null,
    baseUrl: BASE_URL,
    cloudReady: false,
    fontReady: false
  },

  onLaunch() {
    loadMiSans().then((results) => {
      this.globalData.fontReady = results.some(Boolean)
    })

    if (USE_CLOUD) {
      if (!CLOUD_ENV) {
        console.warn('[cloud] 请在 src/assets/js/config.js 填写 CLOUD_ENV')
      } else if (!wx.cloud) {
        console.error('[cloud] 基础库过低，请使用 2.23.0+')
      } else {
        wx.cloud.init({
          env: CLOUD_ENV,
          traceUser: true
        })
        this.globalData.cloudReady = true
      }
    }

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
