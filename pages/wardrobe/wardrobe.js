const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    categories: [],
    activeCategoryId: 0,
    keyword: '',
    activeTag: '',
    list: []
  },

  onShow() {
    const tag = wx.getStorageSync('wardrobe_filter_tag') || ''
    if (tag) {
      wx.removeStorageSync('wardrobe_filter_tag')
      this.setData({ activeTag: tag })
    }
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
    const { activeCategoryId, keyword, activeTag } = this.data
    const params = {}
    if (activeCategoryId) params.categoryId = activeCategoryId
    if (keyword) params.keyword = keyword
    if (activeTag) params.tag = activeTag
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

  clearTag() {
    this.setData({ activeTag: '' }, () => this.loadList())
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
