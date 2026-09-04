const auth = require('./src/assets/js/auth')
const { BASE_URL, USE_CLOUD, CLOUD_ENV, USE_MOCK, RUN_MODE } = require('./src/assets/js/config')
const { loadMiSans } = require('./src/assets/js/fonts')

App({
  globalData: {
    userInfo: null,
    baseUrl: BASE_URL,
    cloudReady: false,
    fontReady: false,
    runMode: RUN_MODE
  },

  onLaunch() {
    console.log('[wardrobe] RUN_MODE =', RUN_MODE, 'BASE_URL =', BASE_URL)

    // local/cloud 下清掉 Mock 残留登录态，避免带着假 token 调真实接口
    if (auth.purgeStaleMockSession(USE_MOCK)) {
      console.warn('[wardrobe] 已清除 Mock 登录态，请重新登录')
      this.globalData.userInfo = null
    }

    // 等首屏请求先走，避免 600K 字体抢启动带宽
    setTimeout(() => {
      loadMiSans().then((results) => {
        this.globalData.fontReady = results.some(Boolean)
      })
    }, 400)

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
    this.globalData.userInfo = token && userInfo ? userInfo : null
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    auth.setUserInfo(userInfo)
  },

  clearSession() {
    // 只清 token，保留本地昵称/头像，供再次登录一键进入
    auth.clear()
    // globalData 仍保留资料展示；是否登录以 token 为准
    const kept = auth.getUserInfo()
    if (kept) this.globalData.userInfo = kept
  }
})
