const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const { USE_MOCK } = require('../../src/assets/js/config')

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    loading: false,
    defaultAvatar: '/src/assets/icons/mine-active.png'
  },

  onChooseAvatar(e) {
    const tempUrl = (e.detail && e.detail.avatarUrl) || ''
    if (!tempUrl) return
    // 微信返回的是临时路径，先本地预览；登录成功后再上传 COS
    this.setData({ avatarUrl: tempUrl })
  },

  onNickname(e) {
    this.setData({ nickname: (e.detail && e.detail.value) || '' })
  },

  onLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    wx.login({
      success: async (res) => {
        try {
          const nickName = this.data.nickname || '微信用户'
          const localAvatar = this.data.avatarUrl || ''

          // code 只能用一次：先登录，再上传头像并回写资料
          const data = await api.loginWithCode(res.code || 'mock_code', {
            nickName,
            avatarUrl: localAvatar.indexOf('http') === 0 ? localAvatar : ''
          })

          const app = getApp()
          app.setUserInfo(data.user)

          if (localAvatar && localAvatar.indexOf('http') !== 0 && !USE_MOCK) {
            try {
              const cosUrl = await upload.uploadImage(localAvatar)
              const user = await api.updateProfile({ nickName, avatarUrl: cosUrl })
              app.setUserInfo(user)
            } catch (e) {
              // 头像上传失败不阻断登录；「我的」页仍可显示本次临时头像
              app.setUserInfo({ ...data.user, avatarUrl: localAvatar })
            }
          }

          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
          }, 400)
        } catch (e) {
          wx.showToast({ title: '登录失败', icon: 'none' })
        } finally {
          this.setData({ loading: false })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: 'wx.login 失败', icon: 'none' })
      }
    })
  }
})
