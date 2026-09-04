const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')
const { pickOccasionSeasonChips } = require('../../src/assets/js/wardrobe-filters')

const PAGE_SIZE = 24

Page({
  data: {
    loggedIn: false,
    categories: [],
    activeCategoryId: 0,
    keyword: '',
    activeTag: '',
    occasionChips: [],
    idleOn: false,
    list: [],
    page: 1,
    hasMore: true,
    loadingMore: false
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({
        categories: [],
        occasionChips: [],
        list: [],
        activeCategoryId: 0,
        activeTag: '',
        idleOn: false,
        page: 1,
        hasMore: true,
        loadingMore: false
      })
      return
    }
    const tag = wx.getStorageSync('wardrobe_filter_tag') || ''
    if (tag) {
      wx.removeStorageSync('wardrobe_filter_tag')
      this.setData({ activeTag: tag })
    }
    wx.removeStorageSync('wardrobe_filter_status')
    if (this._booted && !tag && this.data.categories.length) {
      this.loadList()
      return
    }
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.bootstrap().finally(() => wx.stopPullDownRefresh())
  },

  async bootstrap() {
    try {
      const categories = await api.fetchCategories()
      this.setData({ categories })
      await Promise.all([this.loadOccasionChips(), this.loadList()])
      this._booted = true
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

  async loadList(opts) {
    const reset = !opts || opts.reset !== false
    if (this._loadingList) return
    if (!reset && (!this.data.hasMore || this.data.loadingMore)) return
    const page = reset ? 1 : this.data.page
    const { activeCategoryId, keyword, activeTag, idleOn } = this.data
    const params = { page, pageSize: PAGE_SIZE }
    if (activeCategoryId) params.categoryId = activeCategoryId
    if (keyword) params.keyword = keyword
    if (activeTag) params.tag = activeTag
    if (idleOn) params.idleDays = 14
    this._loadingList = true
    if (!reset) this.setData({ loadingMore: true })
    try {
      const data = await api.fetchClothes(params)
      const chunk = data.list || []
      this.setData({
        list: reset ? chunk : (this.data.list || []).concat(chunk),
        page: page + 1,
        hasMore: !!data.hasMore,
        loadingMore: false
      })
    } catch (e) {
      this.setData({ loadingMore: false })
    } finally {
      this._loadingList = false
    }
  },

  onReachBottom() {
    this.loadList({ reset: false })
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this.loadList(), 300)
  },

  onCategoryTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ activeCategoryId: id }, () => this.loadList())
  },

  onIdleTap() {
    this.setData({ idleOn: !this.data.idleOn }, () => this.loadList())
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
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
