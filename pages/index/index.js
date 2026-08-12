const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')
const location = require('../../src/assets/js/location')

Page({
  data: {
    userInfo: null,
    loggedIn: false,
    stats: {},
    statsValue: '¥0',
    todayOutfit: null,
    todayLabel: '',
    outfitCount: 0,
    defaultAvatar: '/src/assets/icons/mine-active.png',
    suggestLoading: false,
    suggest: { items: [], reason: '', tips: '', seasonHint: '', weatherNote: '' },
    weather: null,
    locationHint: ''
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

    if (auth.isLoggedIn()) {
      this.loadSuggest()
    }
  },

  onRefreshSuggest() {
    this.loadSuggest({ interactive: true })
  },

  async loadSuggest(opts) {
    const interactive = !!(opts && opts.interactive)
    if (!auth.isLoggedIn() || this.data.suggestLoading) return
    this.setData({ suggestLoading: true, locationHint: '' })
    try {
      const loc = await location.getFuzzyLocation({ forceOpenSetting: interactive })
      let locationHint = ''
      let lat
      let lng
      if (location.isLocationOk(loc)) {
        lat = loc.lat
        lng = loc.lng
      } else {
        locationHint = (loc && loc.message) || '未能获取定位'
        if (interactive && loc && loc.error === 'denied') {
          // forceOpenSetting 已处理弹窗；这里再 toast 一次结果
          wx.showToast({ title: '未获得位置授权', icon: 'none' })
        } else if (interactive) {
          wx.showToast({ title: locationHint, icon: 'none' })
        }
      }

      const data = await api.suggestOutfit(lat, lng)
      const weatherNote = (data && data.weatherNote) || ''
      this.setData({
        suggest: {
          items: (data && data.items) || [],
          reason: (data && data.reason) || '',
          tips: (data && data.tips) || '',
          seasonHint: (data && data.seasonHint) || '',
          weatherNote: weatherNote || (locationHint ? '未能获取本地天气，已按当季常识推荐' : '')
        },
        weather: (data && data.weather) || null,
        locationHint
      })
    } catch (e) {
      if (interactive) {
        wx.showToast({ title: '刷新失败', icon: 'none' })
      }
    } finally {
      this.setData({ suggestLoading: false })
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

  goClothing(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/clothing-detail/clothing-detail?id=${id}` })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
