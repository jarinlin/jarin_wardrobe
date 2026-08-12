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
    locationHint: '',
    suggestEngine: '',
    suggestActionLabel: '刷新',
    alerts: []
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
      this.loadAlerts()
    } else {
      this.setData({ alerts: [] })
    }
  },

  async loadAlerts() {
    const alerts = []
    try {
      const tagging = await api.fetchTaggingStatus()
      if (tagging && tagging.failed > 0) {
        alerts.push({
          id: 'tag-failed',
          text: `${tagging.failed} 件衣物打标失败，可去标签管理重试`,
          action: 'tags'
        })
      } else if (tagging && tagging.pending > 0) {
        alerts.push({
          id: 'tag-pending',
          text: `${tagging.pending} 件衣物正在打标中`,
          action: 'tags'
        })
      } else if (tagging && tagging.untagged > 0) {
        alerts.push({
          id: 'tag-empty',
          text: `${tagging.untagged} 件有图衣物尚未打标`,
          action: 'tags'
        })
      }
    } catch (e) {}
    try {
      const meal = util.guessMealType()
      if (meal !== 'other') {
        const today = util.formatDate()
        const data = await api.fetchDietLogs({ date: today })
        const list = (data && data.list) || []
        const hasMeal = list.some((x) => x.mealType === meal)
        if (!hasMeal) {
          const label = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }[meal] || '这一餐'
          alerts.push({
            id: 'diet-meal',
            text: `还没记${label}，点此记录饮食`,
            action: 'diet'
          })
        }
      }
    } catch (e) {}
    this.setData({ alerts })
  },

  onAlertTap(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'tags') {
      if (!util.ensureLogin()) return
      wx.navigateTo({ url: '/pages/tags/tags' })
      return
    }
    if (action === 'diet') {
      if (!util.ensureLogin()) return
      wx.navigateTo({ url: '/pages/diet/diet' })
    }
  },

  onRefreshSuggest() {
    this.loadSuggest({ interactive: true })
  },

  async loadSuggest(opts) {
    const interactive = !!(opts && opts.interactive)
    if (!auth.isLoggedIn() || this.data.suggestLoading) return
    this.setData({ suggestLoading: true, locationHint: '', suggestActionLabel: '获取中…' })
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
      const suggestEngine = (data && data.engine) || ''
      this.setData({
        suggest: {
          items: (data && data.items) || [],
          reason: (data && data.reason) || '',
          tips: (data && data.tips) || '',
          seasonHint: (data && data.seasonHint) || '',
          weatherNote: weatherNote || (locationHint ? '未能获取本地天气，已按当季常识推荐' : '')
        },
        weather: (data && data.weather) || null,
        locationHint,
        suggestEngine,
        suggestLoading: false,
        suggestActionLabel: suggestEngine === 'ai' ? 'AI · 刷新' : '刷新'
      })
      // 天气 tips 也可作为提醒
      if (data && data.tips && data.weather) {
        const alerts = (this.data.alerts || []).filter((a) => a.id !== 'weather-tip')
        alerts.unshift({ id: 'weather-tip', text: data.tips, action: '' })
        this.setData({ alerts: alerts.slice(0, 4) })
      }
    } catch (e) {
      if (interactive) {
        wx.showToast({ title: '刷新失败', icon: 'none' })
      }
      const engine = this.data.suggestEngine
      this.setData({
        suggestLoading: false,
        suggestActionLabel: engine === 'ai' ? 'AI · 刷新' : '刷新'
      })
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

  /** 把今日建议单品带进穿搭编辑页 */
  goOutfitFromSuggest() {
    if (!util.ensureLogin()) return
    const items = (this.data.suggest && this.data.suggest.items) || []
    if (!items.length) {
      wx.showToast({ title: '暂无建议单品，先去添加衣物', icon: 'none' })
      return
    }
    const ids = items.map((c) => c.id).filter(Boolean)
    const parts = []
    if (this.data.weather) {
      const w = this.data.weather
      parts.push(`${w.city || ''} ${w.weather || ''} ${w.temperature || ''}℃`.trim())
    }
    if (this.data.suggest.tips) parts.push(this.data.suggest.tips)
    else if (this.data.suggest.reason) parts.push(this.data.suggest.reason)
    try {
      wx.setStorageSync('suggest_outfit_ids', ids)
      wx.setStorageSync('suggest_outfit_note', parts.filter(Boolean).join(' · '))
    } catch (e) {}
    wx.navigateTo({ url: '/pages/outfit-edit/outfit-edit?fromSuggest=1' })
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
