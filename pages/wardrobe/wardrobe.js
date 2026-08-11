const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    categories: [],
    activeCategoryId: 0,
    keyword: '',
    list: []
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    try {
      const categories = await api.fetchCategories()
      this.setData({ categories })
      await this.loadList()
    } catch (e) {}
  },

  async loadList() {
    const { activeCategoryId, keyword } = this.data
    const params = {}
    if (activeCategoryId) params.categoryId = activeCategoryId
    if (keyword) params.keyword = keyword
    try {
      const list = await api.fetchClothes(params)
      this.setData({ list })
    } catch (e) {}
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },

  onCategoryTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ activeCategoryId: id }, () => this.loadList())
  },

  goAdd() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/clothing-edit/clothing-edit' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clothing-detail/clothing-detail?id=${id}` })
  },

  goCategory() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/category/category' })
  }
})
