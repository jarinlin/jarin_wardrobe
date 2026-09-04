const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')
const location = require('../../src/assets/js/location')
const { buildDayCard, isBodyReady, promptBodyProfile, scheduleAdviceRetry } = require('../../src/assets/js/diet-metrics')

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
    suggestActionLabel: '换一套',
    wardrobeSparse: false,
    alerts: [],
    bodyReady: false,
    diet: {
      suggestDay: 0,
      todayKcal: 0,
      remainText: '—',
      remainLabel: '还可摄入',
      remainClass: '',
      sub: '去记录',
      aiAdvice: '',
      homeMacros: []
    }
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh({ force: true }).finally(() => wx.stopPullDownRefresh())
  },

  async refresh(opts) {
    const force = !!(opts && opts.force)
    const loggedIn = auth.isLoggedIn()
    const userInfo = loggedIn ? auth.getUserInfo() : null
    const today = util.formatDate()
    this.setData({
      userInfo,
      loggedIn,
      todayLabel: util.formatDisplayDate(today)
    })

    if (!loggedIn) {
      this._suggestAt = 0
      this.setData({
        stats: {},
        statsValue: '¥0',
        todayOutfit: null,
        outfitCount: 0,
        suggest: { items: [], reason: '', tips: '', seasonHint: '', weatherNote: '' },
        weather: null,
        locationHint: '',
        alerts: [],
        bodyReady: false,
        diet: { suggestDay: 0, todayKcal: 0, remainText: '—', remainLabel: '还可摄入', remainClass: '', sub: '去记录', aiAdvice: '', homeMacros: [] }
      })
      return
    }

    try {
      const [stats, todayOutfit] = await Promise.all([
        api.fetchStats(),
        api.fetchTodayOutfit(today)
      ])
      this.setData({
        stats,
        statsValue: util.formatPrice(stats.value || 0),
        todayOutfit,
        outfitCount: Number(stats.outfitCount) || 0
      })
    } catch (e) {
      // mock / 网络失败时保持静默
    }

    const hasSuggest = !!(this.data.suggest && this.data.suggest.items && this.data.suggest.items.length)
    const suggestFresh = Date.now() - (this._suggestAt || 0) < 3 * 60 * 1000
    if (force || !hasSuggest || !suggestFresh) {
      this.loadSuggest(force ? { refresh: true } : undefined)
    }
    this.loadDietAndAlerts()
  },

  async loadDietAndAlerts() {
    const alerts = []
    let metrics = {}
    let todayKcal = 0
    let bodyReady = false
    let aiAdvice = ''
    let hasTodayLogs = false
    try {
      const body = await api.fetchBodyProfile()
      metrics = (body && body.metrics) || {}
      bodyReady = isBodyReady(body)
    } catch (e) {}
    let dietData = { totalCalories: 0 }
    if (bodyReady) {
      try {
        const meal = util.guessMealType()
        const today = util.formatDate()
        const data = await api.fetchDietLogs({ date: today })
        dietData = data || dietData
        const list = (data && data.list) || []
        todayKcal = Math.round(Number(data && data.totalCalories) || 0)
        aiAdvice = (data && data.aiAdvice) || ''
        hasTodayLogs = list.length > 0
        if (meal !== 'other') {
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
    }
    this.setData({ alerts, bodyReady, diet: buildDayCard(metrics, dietData, aiAdvice) })
    scheduleAdviceRetry(this, hasTodayLogs, aiAdvice)
  },

  refreshDietAdvice() {
    this.loadDietAndAlerts()
  },

  onAlertTap(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'diet') {
      this.goDiet()
    }
  },

  goDiet() {
    if (!util.ensureLogin()) return
    if (!this.data.bodyReady) {
      promptBodyProfile()
      return
    }
    wx.switchTab({ url: '/pages/diet/diet' })
  },

  onAvatarTap() {
    if (!auth.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onRefreshSuggest() {
    this.loadSuggest({ interactive: true, swap: true })
  },

  async loadSuggest(opts) {
    const interactive = !!(opts && opts.interactive)
    const swap = !!(opts && opts.swap)
    const bustCache = !!(opts && opts.refresh)
    if (!auth.isLoggedIn() || this.data.suggestLoading) return
    const prevItems = ((this.data.suggest && this.data.suggest.items) || []).slice()
    this.setData({ suggestLoading: true, locationHint: '', suggestActionLabel: '获取中…' })
    try {
      let data
      let locationHint = ''
      let lat
      let lng
      const exclude = swap
        ? prevItems.map((c) => c.id).filter(Boolean)
        : []

      if (interactive) {
        console.log('[suggest] 强制刷新，先取定位再 refresh=1')
        const loc = await location.getFuzzyLocation({ forceOpenSetting: true })
        if (location.isLocationOk(loc)) {
          lat = Number(loc.lat)
          lng = Number(loc.lng)
        } else {
          const last = location.lastFuzzyLocation()
          if (last) {
            lat = last.lat
            lng = last.lng
            console.warn('[suggest] 本次定位失败，使用上次坐标', last)
          } else {
            locationHint = (loc && loc.message) || '未能获取定位'
            console.warn('[suggest] 刷新未拿到坐标，中止 refresh=1', loc)
            if (loc && loc.error === 'denied') {
              wx.showToast({ title: '未获得位置授权', icon: 'none' })
            } else {
              wx.showToast({ title: locationHint, icon: 'none' })
            }
            this.setData({
              locationHint,
              suggestLoading: false,
              suggestActionLabel: prevItems.length ? '换一套' : '刷新',
              'suggest.weatherNote': this.data.suggest.weatherNote || '未能获取本地天气，已按当季常识推荐'
            })
            return
          }
        }
        console.log('[suggest] 刷新带坐标', lat, lng)
        data = await api.suggestOutfit(lat, lng, { refresh: true, exclude })
      } else {
        console.log(bustCache ? '[suggest] 下拉刷新，refresh=1' : '[suggest] 缓存优先：先不传 lat/lng')
        data = await api.suggestOutfit(undefined, undefined, bustCache ? { refresh: true } : undefined)
        if (data && data.needLocation) {
          console.log('[suggest] 后端 needLocation，开始 getFuzzyLocation')
          const loc = await location.getFuzzyLocation({ forceOpenSetting: false })
          if (location.isLocationOk(loc)) {
            lat = Number(loc.lat)
            lng = Number(loc.lng)
            console.log('[suggest] 定位成功，带坐标重试', lat, lng)
            data = await api.suggestOutfit(lat, lng)
          } else {
            const last = location.lastFuzzyLocation()
            if (last) {
              lat = last.lat
              lng = last.lng
              console.warn('[suggest] 定位失败，使用上次坐标重试', last)
              data = await api.suggestOutfit(lat, lng)
            } else {
              locationHint = (loc && loc.message) || '未能获取定位'
              console.warn('[suggest] 定位失败，fallback 无天气建议', loc)
              data = await api.suggestOutfit(null, null, { fallback: true })
            }
          }
        } else {
          console.log('[suggest] 命中缓存或直接返回', {
            cached: !!(data && data.cached),
            hasWeather: !!(data && data.weather),
            engine: data && data.engine
          })
        }
      }

      const weatherNote = (data && data.weatherNote) || ''
      const suggestEngine = (data && data.engine) || ''
      if (!locationHint && !(data && data.weather)) {
        locationHint = '点换一套并开启定位，可按当地天气推荐'
      }
      let items = (data && data.items) || []
      if (swap && prevItems.length && data && data.canSwap === false) {
        wx.showToast({ title: '再添几件才能换一套', icon: 'none' })
        items = prevItems
      }
      this.setData({
        suggest: {
          items,
          reason: (data && data.reason) || '',
          tips: (data && data.tips) || '',
          seasonHint: (data && data.seasonHint) || '',
          weatherNote: weatherNote || (locationHint ? '未能获取本地天气，已按当季常识推荐' : '')
        },
        weather: (data && data.weather) || null,
        locationHint,
        suggestEngine,
        wardrobeSparse: !!(data && data.wardrobeSparse),
        suggestLoading: false,
        suggestActionLabel: items.length ? '换一套' : '刷新'
      })
      this._suggestAt = Date.now()
    } catch (e) {
      console.warn('[suggest] 请求失败', e)
      if (interactive) {
        wx.showToast({ title: '换一套失败', icon: 'none' })
      }
      this.setData({
        suggestLoading: false,
        suggestActionLabel: (this.data.suggest && this.data.suggest.items && this.data.suggest.items.length) ? '换一套' : '刷新'
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
