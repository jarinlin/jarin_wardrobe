const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')
const { pickOccasionSeasonChips } = require('../../src/assets/js/wardrobe-filters')

Page({
  data: {
    categories: [],
    activeCategoryId: 0,
    keyword: '',
    activeTag: '',
    occasionChips: [],
    list: []
  },

  onShow() {
    if (!auth.requireLogin()) return
    const tag = wx.getStorageSync('wardrobe_filter_tag') || ''
    if (tag) {
      wx.removeStorageSync('wardrobe_filter_tag')
      this.setData({ activeTag: tag })
    }
    wx.removeStorageSync('wardrobe_filter_status')
    this.bootstrap()
  },

  async bootstrap() {
    try {
      const categories = await api.fetchCategories()
      this.setData({ categories })
      await Promise.all([this.loadOccasionChips(), this.loadList()])
    } catch (e) {}
  },

  async loadOccasionChips() {
    try {
      const data = await api.fetchTags()
      const occasionChips = pickOccasionSeasonChips((data && data.fromClothes) || [])
      this.setData({ occasionChips })
    } catch (e) {
      this.setData({ occasionChips: [] })
    }
  },

  async loadList() {
    const { activeCategoryId, keyword, activeTag } = this.data
    const params = {}
    if (activeCategoryId) params.categoryId = activeCategoryId
    if (keyword) params.keyword = keyword
    if (activeTag) params.tag = activeTag
    try {
      const list = await api.fetchClothes(params)
      this.setData({ list: list || [] })
    } catch (e) {}
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },

  onCategoryTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ activeCategoryId: id }, () => this.loadList())
  },

  onOccasionTap(e) {
    const tag = e.currentTarget.dataset.tag || ''
    const next = this.data.activeTag === tag ? '' : tag
    this.setData({ activeTag: next }, () => this.loadList())
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
  },

  goTags() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/tags/tags' })
  }
})
