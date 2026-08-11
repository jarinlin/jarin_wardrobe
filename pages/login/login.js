const api = require('../../src/assets/js/api')

Page({
  data: {
    nickname: 'Jarin',
    avatarUrl: '',
    loading: false,
    defaultAvatar: '/src/assets/icons/mine-active.png'
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value })
  },

  onLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    wx.login({
      success: async (res) => {
        try {
          const data = await api.loginWithCode(res.code || 'mock_code', {
            nickName: this.data.nickname || 'Jarin',
            avatarUrl: this.data.avatarUrl
          })
          const app = getApp()
          app.setUserInfo(data.user)
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
