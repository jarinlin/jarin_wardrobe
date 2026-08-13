const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')

Page({
  data: {
    loggedIn: false,
    id: null,
    item: null,
    priceText: '—'
  },

  onLoad(query) {
    this.setData({ id: query.id })
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ item: null })
      return
    }
    if (this.data.id) this.loadDetail()
  },

  async loadDetail() {
    try {
      const item = await api.fetchClothingDetail(this.data.id)
      this.setData({
        item,
        priceText: util.formatPrice(item.price)
      })
    } catch (e) {
      wx.showToast({ title: '衣物不存在', icon: 'none' })
    }
  },

  onEdit() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: `/pages/clothing-edit/clothing-edit?id=${this.data.id}` })
  },

  onDelete() {
    if (!util.ensureLogin()) return
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
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
