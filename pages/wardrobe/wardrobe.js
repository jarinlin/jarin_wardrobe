const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const { STATUS_CHIPS, pickOccasionSeasonChips } = require('../../src/assets/js/wardrobe-filters')

Page({
  data: {
    categories: [],
    activeCategoryId: 0,
    keyword: '',
    activeTag: '',
    activeStatus: '',
    statusChips: STATUS_CHIPS,
    occasionChips: [],
    list: [],
    showRetagHint: false
  },

  onShow() {
    const tag = wx.getStorageSync('wardrobe_filter_tag') || ''
    const status = wx.getStorageSync('wardrobe_filter_status') || ''
    if (tag) {
      wx.removeStorageSync('wardrobe_filter_tag')
      this.setData({ activeTag: tag })
    }
    if (status) {
      wx.removeStorageSync('wardrobe_filter_status')
      this.setData({ activeStatus: status })
    }
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
    const { activeCategoryId, keyword, activeTag, activeStatus } = this.data
    const params = {}
    if (activeCategoryId) params.categoryId = activeCategoryId
    if (keyword) params.keyword = keyword
    if (activeTag) params.tag = activeTag
    if (activeStatus) params.tagsStatus = activeStatus
    try {
      const raw = await api.fetchClothes(params)
      const list = (raw || []).map((item) => {
        const status = item.tagsStatus || ''
        let statusLabel = status
        if (status === 'pending') statusLabel = '打标中'
        else if (status === 'failed') statusLabel = '失败'
        return {
          ...item,
          showStatusBadge: !!(status && status !== 'ready'),
          statusLabel
        }
      })
      const showRetagHint = activeStatus === 'failed' || activeStatus === 'untagged' || activeStatus === 'pending'
      this.setData({ list, showRetagHint })
    } catch (e) {}
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },

  onCategoryTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ activeCategoryId: id }, () => this.loadList())
  },

  onStatusTap(e) {
    const id = e.currentTarget.dataset.id || ''
    this.setData({ activeStatus: id }, () => this.loadList())
  },

  onOccasionTap(e) {
    const tag = e.currentTarget.dataset.tag || ''
    const next = this.data.activeTag === tag ? '' : tag
    this.setData({ activeTag: next }, () => this.loadList())
  },

  clearTag() {
    this.setData({ activeTag: '' }, () => this.loadList())
  },

  goTags() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/tags/tags' })
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
