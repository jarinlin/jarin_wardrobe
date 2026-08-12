const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    fromClothes: [],
    displayList: [],
    keyword: ''
  },

  onShow() {
    if (!util.ensureLogin()) return
    this.loadList()
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
  }
})
