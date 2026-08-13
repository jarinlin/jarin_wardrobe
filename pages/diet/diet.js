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
      aiAdvice: ''
    },
    weekLine: ''
  },

  onShow() {
    if (!auth.requireLogin()) return
    this._dietAdviceRetried = false
    this.refresh()
  },

  async refresh() {
    this.setData({ dateLabel: this.data.date })
    let metrics = {}
    let bodyReady = false
    try {
      const body = await api.fetchBodyProfile()
      metrics = body.metrics || {}
      bodyReady = isBodyReady(body)
      const bodyFatText = metrics.bodyFatPct ? `${metrics.bodyFatPct}%` : '—'
      const metricsTip = bodyReady
        ? `建议日摄入约 ${metrics.suggestKcal || '—'} kcal · 点此改档案`
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
        day: buildDayCard(metrics, 0, ''),
        weekLine: ''
      })
      return
    }

    let weekLine = ''
    try {
      const week = await api.fetchDietWeekSummary()
      weekLine = buildWeekLine(week)
    } catch (e) {}

    let todayKcal = 0
    try {
      const data = await api.fetchDietLogs({ date: this.data.date })
      const rawList = data.list || []
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
          displayTitle: item.foodName || (items[0] && items[0].foodName) || '未命名',
          displaySub: subtitle,
          displayKcal: Math.round(Number(item.calories) || 0),
          placeholderUrl: mealPlaceholderUrl(item.mealType)
        }
      })
      const selectedKcal = Math.round(data.totalCalories || 0)
      todayKcal = selectedKcal
      let aiAdvice = data.aiAdvice || ''
      let hasTodayLogs = this.data.date === todayStr() && list.length > 0
      const today = todayStr()
      if (this.data.date !== today) {
        try {
          const todayData = await api.fetchDietLogs({ date: today })
          todayKcal = Math.round(todayData.totalCalories || 0)
          aiAdvice = todayData.aiAdvice || ''
          hasTodayLogs = ((todayData.list || []).length > 0) || todayKcal > 0
        } catch (e) {
          todayKcal = 0
          aiAdvice = ''
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
        day: buildDayCard(metrics, todayKcal, aiAdvice),
        weekLine
      })
      scheduleAdviceRetry(this, hasTodayLogs, aiAdvice)
    } catch (e) {
      this.setData({
        list: [],
        todayKcal: 0,
        mealHint: '',
        day: buildDayCard(metrics, 0, ''),
        weekLine
      })
    }
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
  }
})
