const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    id: null,
    item: null,
    priceText: '—'
  },

  _pollTimer: null,

  onLoad(query) {
    this.setData({ id: query.id })
  },

  onShow() {
    if (this.data.id) this.loadDetail()
  },

  onHide() {
    this.clearPoll()
  },

  onUnload() {
    this.clearPoll()
  },

  clearPoll() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer)
      this._pollTimer = null
    }
  },

  schedulePoll(status) {
    this.clearPoll()
    if (status !== 'pending') return
    this._pollTimer = setTimeout(() => this.loadDetail(), 2800)
  },

  async loadDetail() {
    try {
      const item = await api.fetchClothingDetail(this.data.id)
      this.setData({
        item,
        priceText: util.formatPrice(item.price)
      })
      this.schedulePoll(item.tagsStatus)
    } catch (e) {
      wx.showToast({ title: '衣物不存在', icon: 'none' })
    }
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/clothing-edit/clothing-edit?id=${this.data.id}` })
  },

  async onRetag() {
    try {
      await api.retagClothing(this.data.id)
      wx.showToast({ title: '已开始打标', icon: 'none' })
      this.setData({ 'item.tagsStatus': 'pending' })
      this.schedulePoll('pending')
    } catch (e) {
      wx.showToast({ title: e.message || '打标失败', icon: 'none' })
    }
  },

  onDelete() {
    wx.showModal({
      title: '删除衣物',
      content: '删除后不可恢复，确定吗？',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        await api.deleteClothing(this.data.id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      }
    })
  }
})
