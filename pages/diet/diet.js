const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')
const { buildDayCard, isBodyReady, promptBodyProfile, mealPlaceholderUrl, scheduleAdviceRetry, buildWeekLine } = require('../../src/assets/js/diet-metrics')

function todayStr() {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

Page({
  data: {
    loggedIn: false,
    date: todayStr(),
    dateLabel: '',
    list: [],
    todayKcal: 0,
    metrics: {},
    bodyFatText: '—',
    bodyReady: false,
    bodyChecked: false,
    metricsTip: '先完善身高体重才能记饮食 →',
    mealHint: '',
    nutrientsExpanded: false,
    day: {
      suggestDay: 0,
      todayKcal: 0,
      remainText: '—',
      remainLabel: '还可摄入',
      remainOver: false,
      ratioPct: 0,
      remainClass: '',
      barClass: 'week-bar-fill',
      sub: '对照建议看还能吃多少',
      tip: '',
      aiAdvice: '',
      progress: [],
      incompleteTip: ''
    },
    weekLine: ''
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({
        list: [],
        todayKcal: 0,
        metrics: {},
        bodyFatText: '—',
        bodyReady: false,
        bodyChecked: false,
        mealHint: '',
        weekLine: ''
      })
      return
    }
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh({ force: true }).finally(() => wx.stopPullDownRefresh())
  },

  async refresh(opts) {
    const force = !!(opts && opts.force)
    this.setData({ dateLabel: util.formatDisplayDate(this.data.date) })
    let metrics = {}
    let bodyReady = false
    try {
      const body = await api.fetchBodyProfile()
      metrics = body.metrics || {}
      bodyReady = isBodyReady(body)
      const bodyFatText = metrics.bodyFatText || (metrics.bodyFatPct ? `${metrics.bodyFatPct}%` : '—')
      const metricsTip = bodyReady
        ? `建议热量约 ${metrics.suggestKcal || '—'} kcal · 点此改档案`
        : '先完善身高体重才能记饮食 →'
      this.setData({ metrics, bodyFatText, bodyReady, bodyChecked: true, metricsTip })
    } catch (e) {
      this.setData({
        metrics: {},
        bodyFatText: '—',
        bodyReady: false,
        bodyChecked: true,
        metricsTip: '先完善身高体重才能记饮食 →'
      })
    }

    if (!bodyReady) {
      this.setData({
        list: [],
        todayKcal: 0,
        mealHint: '',
        day: buildDayCard(metrics, { totalCalories: 0 }, ''),
        weekLine: ''
      })
      return
    }

    let weekLine = this.data.weekLine || ''
    const weekFresh = Date.now() - (this._weekAt || 0) < 60 * 1000
    if (force || !weekLine || !weekFresh) {
      try {
        const week = await api.fetchDietWeekSummary()
        weekLine = buildWeekLine(week)
        this._weekAt = Date.now()
      } catch (e) {}
    }

    let todayKcal = 0
    try {
      const data = await api.fetchDietLogs({ date: this.data.date })
      const rawList = data.list || []
      const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', other: '其他' }
      const list = rawList.map((item) => {
        const items = Array.isArray(item.items) ? item.items : []
        const count = item.itemCount != null ? item.itemCount : items.length
        let subtitle = item.portion || ''
        if (count > 1) {
          const first = (items[0] && items[0].foodName) || item.foodName || '未命名'
          subtitle = `${first} 等 · 共${count}道`
        } else if (count === 1) {
          subtitle = (items[0] && items[0].portion) || item.portion || '共1道'
        }
        return {
          ...item,
          mealTypeLabel: mealLabels[item.mealType] || '其他',
          displayTitle: item.foodName || (items[0] && items[0].foodName) || '未命名',
          displaySub: subtitle,
          displayKcal: Math.round(Number(item.calories) || 0),
          macroLine: item.nutrition && item.nutrition.hasMacros
            ? `蛋白 ${Math.round(item.nutrition.proteinG || 0)}g · 碳水 ${Math.round(item.nutrition.carbsG || 0)}g · 脂肪 ${Math.round(item.nutrition.fatG || 0)}g`
            : '',
          placeholderUrl: mealPlaceholderUrl(item.mealType)
        }
      })
      const selectedKcal = Math.round(data.totalCalories || 0)
      const today = todayStr()
      const isToday = this.data.date === today
      todayKcal = isToday ? selectedKcal : 0
      let aiAdvice = isToday ? (data.aiAdvice || '') : ''
      let hasTodayLogs = isToday && list.length > 0
      if (!isToday) {
        try {
          const todayData = await api.fetchDietLogs({ date: today })
          todayKcal = Math.round(todayData.totalCalories || 0)
          hasTodayLogs = ((todayData.list || []).length > 0) || todayKcal > 0
        } catch (e) {
          todayKcal = 0
          hasTodayLogs = false
        }
      }
      let mealHint = ''
      if (this.data.date === today) {
        const meal = util.guessMealType()
        const labels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }
        if (labels[meal] && !list.some((x) => x.mealType === meal)) {
          mealHint = `当前时段适合记${labels[meal]}，点「记一餐」已预选`
        }
      }
      this.setData({
        list,
        todayKcal,
        mealHint,
        day: buildDayCard(metrics, data, aiAdvice),
        weekLine
      })
      scheduleAdviceRetry(this, hasTodayLogs, aiAdvice)
    } catch (e) {
      this.setData({
        list: [],
        todayKcal: 0,
        mealHint: '',
        day: buildDayCard(metrics, { totalCalories: 0 }, ''),
        weekLine
      })
    }
  },

  onToggleNutrients() {
    this.setData({ nutrientsExpanded: !this.data.nutrientsExpanded })
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
    this.refresh()
  },

  goBody() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/body-profile/body-profile' })
  },

  goCreate() {
    if (!util.ensureLogin()) return
    if (!this.data.bodyReady) {
      promptBodyProfile()
      return
    }
    wx.navigateTo({ url: '/pages/diet-edit/diet-edit?date=' + this.data.date })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/diet-edit/diet-edit?id=' + id })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
