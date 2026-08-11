const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')

Page({
  data: {
    userInfo: null,
    loggedIn: false,
    stats: {},
    statsValue: '¥0',
    todayOutfit: null,
    todayLabel: '',
    outfitCount: 0,
    defaultAvatar: '/src/assets/icons/mine-active.png'
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const userInfo = auth.getUserInfo()
    const today = util.formatDate()
    this.setData({
      userInfo,
      loggedIn: auth.isLoggedIn(),
      todayLabel: util.formatDisplayDate(today)
    })

    try {
      const [stats, todayOutfit, outfits] = await Promise.all([
        api.fetchStats(),
        api.fetchTodayOutfit(today),
        api.fetchOutfits()
      ])
      this.setData({
        stats,
        statsValue: util.formatPrice(stats.value || 0),
        todayOutfit,
        outfitCount: (outfits || []).length
      })
    } catch (e) {
      // mock / 网络失败时保持静默
    }
  },

  goWardrobe() {
    wx.switchTab({ url: '/pages/wardrobe/wardrobe' })
  },

  goOutfit() {
    wx.switchTab({ url: '/pages/outfit/outfit' })
  },

  goOutfitEdit() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/outfit-edit/outfit-edit' })
  },

  goOutfitDetail() {
    const id = this.data.todayOutfit && this.data.todayOutfit.id
    if (!id) return
    wx.navigateTo({ url: `/pages/outfit-detail/outfit-detail?id=${id}` })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
