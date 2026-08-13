const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')

Page({
  data: {
    list: []
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadList()
  },

  async loadList() {
    try {
      const list = await api.fetchOutfits()
      this.setData({
        list: (list || []).map((o) => ({
          ...o,
          dateLabel: util.formatDisplayDate(o.date)
        }))
      })
    } catch (e) {}
  },

  goCreate() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/outfit-edit/outfit-edit' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/outfit-detail/outfit-detail?id=${id}` })
  }
})
