const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')

Page({
  data: {
    userInfo: null,
    loggedIn: false,
    stats: {},
    statsValue: '¥0',
    mostWorn: '—',
    defaultAvatar: '/src/assets/icons/mine-active.png'
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const userInfo = auth.getUserInfo()
    this.setData({
      userInfo,
      loggedIn: auth.isLoggedIn()
    })
    try {
      const stats = await api.fetchStats()
      this.setData({
        stats,
        statsValue: util.formatPrice(stats.value || 0),
        mostWorn: (stats.mostWorn && stats.mostWorn.name) || '—'
      })
    } catch (e) {}
  },

  onProfileTap() {
    if (!auth.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
    }
  },

  goDiet() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/diet/diet' })
  },

  goBody() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/body-profile/body-profile' })
  },

  goCategory() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/category/category' })
  },

  goTags() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/tags/tags' })
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号？',
      success: (res) => {
        if (!res.confirm) return
        getApp().clearSession()
        this.refresh()
        wx.showToast({ title: '已退出', icon: 'none' })
      }
    })
  }
})
