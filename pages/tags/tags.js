const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    fromClothes: [],
    displayList: [],
    keyword: '',
    tagging: null,
    showTagOps: false
  },

  onShow() {
    if (!util.ensureLogin()) return
    this.loadList()
    this.loadTagging()
  },

  async loadList() {
    try {
      const data = await api.fetchTags()
      const fromClothes = ((data && data.fromClothes) || []).slice()
      fromClothes.sort((a, b) => (b.count || 0) - (a.count || 0))
      this.setData({ fromClothes }, () => this.applyFilter())
    } catch (e) {
      this.setData({ fromClothes: [], displayList: [] })
    }
  },

  async loadTagging() {
    try {
      const tagging = await api.fetchTaggingStatus()
      const showTagOps =
        (Number(tagging && tagging.failed) || 0) +
          (Number(tagging && tagging.pending) || 0) +
          (Number(tagging && tagging.untagged) || 0) >
        0
      this.setData({ tagging, showTagOps })
    } catch (e) {
      this.setData({ tagging: null, showTagOps: false })
    }
  },

  onRefreshTagging() {
    this.loadTagging()
  },

  async onRetagFailed() {
    wx.showLoading({ title: '排队中' })
    try {
      const res = await api.retagBatch('failed')
      wx.hideLoading()
      wx.showToast({ title: `已排队 ${res.queued || 0} 件`, icon: 'none' })
      this.loadTagging()
    } catch (e) {
      wx.hideLoading()
    }
  },

  async onRetagUntagged() {
    wx.showLoading({ title: '排队中' })
    try {
      const res = await api.retagBatch('untagged')
      wx.hideLoading()
      wx.showToast({ title: `已排队 ${res.queued || 0} 件`, icon: 'none' })
      this.loadTagging()
    } catch (e) {
      wx.hideLoading()
    }
  },

  applyFilter() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const list = this.data.fromClothes || []
    const displayList = kw
      ? list.filter((t) => (t.name || '').toLowerCase().includes(kw))
      : list
    this.setData({ displayList })
  },

  onFilterInput(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilter())
  },

  goWardrobe(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    wx.setStorageSync('wardrobe_filter_tag', tag)
    wx.switchTab({ url: '/pages/wardrobe/wardrobe' })
  },

  goWardrobeFailed() {
    wx.setStorageSync('wardrobe_filter_status', 'failed')
    wx.switchTab({ url: '/pages/wardrobe/wardrobe' })
  }
})
