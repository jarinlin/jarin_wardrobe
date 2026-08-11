const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    id: null,
    item: null,
    dateLabel: ''
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.loadDetail()
  },

  async loadDetail() {
    try {
      const item = await api.fetchOutfitDetail(this.data.id)
      this.setData({
        item,
        dateLabel: util.formatDisplayDate(item.date)
      })
    } catch (e) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
    }
  },

  onDelete() {
    wx.showModal({
      title: '删除穿搭',
      content: '确定删除这条穿搭记录？',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        await api.deleteOutfit(this.data.id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      }
    })
  }
})
