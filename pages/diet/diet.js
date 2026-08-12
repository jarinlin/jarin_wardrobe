const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

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
    bodyReady: false,
    metricsTip: '先完善身高体重，识别建议更准 →',
    mealHint: '',
    week: {
      totalCalories: 0,
      daysWithLog: 0,
      avgDaily: 0,
      suggestWeek: 0,
      ratioPct: 0,
      tip: ''
    }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    this.setData({ dateLabel: this.data.date })
    let metrics = {}
    let bodyReady = false
    try {
      const body = await api.fetchBodyProfile()
      metrics = body.metrics || {}
      bodyReady = !!(body.heightCm && body.weightKg)
      const metricsTip = bodyReady
        ? `建议日摄入约 ${metrics.suggestKcal || '—'} kcal · 点此改档案`
        : '先完善身高体重，识别建议更准 →'
      this.setData({ metrics, bodyReady, metricsTip })
    } catch (e) {
      this.setData({
        metrics: {},
        bodyReady: false,
        metricsTip: '先完善身高体重，识别建议更准 →'
      })
    }

    try {
      const weekRaw = await api.fetchDietWeekSummary()
      const suggestKcal = Number(metrics.suggestKcal) || 0
      const total = Math.round(Number(weekRaw.totalCalories) || 0)
      const suggestWeek = suggestKcal > 0 ? Math.round(suggestKcal * 7) : 0
      let ratioPct = 0
      if (suggestWeek > 0) {
        ratioPct = Math.min(100, Math.round((total / suggestWeek) * 100))
      }
      let tip = '近 7 日饮食汇总'
      if (suggestWeek > 0) {
        if (total === 0) tip = '近 7 日暂无记录，建议日摄入约 ' + suggestKcal + ' kcal'
        else if (ratioPct < 70) tip = '低于建议周摄入约 ' + (100 - ratioPct) + '%'
        else if (ratioPct <= 110) tip = '接近建议周摄入（' + suggestWeek + ' kcal）'
        else tip = '高于建议周摄入约 ' + (ratioPct - 100) + '%'
      }
      this.setData({
        week: {
          totalCalories: total,
          daysWithLog: weekRaw.daysWithLog || 0,
          avgDaily: Math.round(Number(weekRaw.avgDaily) || 0),
          suggestWeek,
          ratioPct,
          tip
        }
      })
    } catch (e) {
      this.setData({
        week: {
          totalCalories: 0,
          daysWithLog: 0,
          avgDaily: 0,
          suggestWeek: 0,
          ratioPct: 0,
          tip: ''
        }
      })
    }

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
          displayKcal: Math.round(Number(item.calories) || 0)
        }
      })
      let mealHint = ''
      if (this.data.date === todayStr()) {
        const meal = util.guessMealType()
        const labels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }
        if (labels[meal] && !list.some((x) => x.mealType === meal)) {
          mealHint = `当前时段适合记${labels[meal]}，点「记一餐」已预选`
        }
      }
      this.setData({
        list,
        todayKcal: Math.round(data.totalCalories || 0),
        mealHint
      })
    } catch (e) {
      this.setData({ list: [], todayKcal: 0, mealHint: '' })
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
    wx.navigateTo({ url: '/pages/diet-edit/diet-edit?date=' + this.data.date })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/diet-edit/diet-edit?id=' + id })
  }
})
