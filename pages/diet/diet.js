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
    bodyReady: false
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    this.setData({ dateLabel: this.data.date })
    try {
      const body = await api.fetchBodyProfile()
      const metrics = body.metrics || {}
      const bodyReady = !!(body.heightCm && body.weightKg)
      this.setData({ metrics, bodyReady })
    } catch (e) {}
    try {
      const data = await api.fetchDietLogs({ date: this.data.date })
      this.setData({
        list: data.list || [],
        todayKcal: Math.round(data.totalCalories || 0)
      })
    } catch (e) {
      this.setData({ list: [], todayKcal: 0 })
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
