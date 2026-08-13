const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')
const ootd = require('../../src/assets/js/ootd')

Page({
  data: {
    tab: 'mine',
    list: [],
    feed: [],
    feedKey: 'week',
    defaultAvatar: ootd.DEFAULT_AVATAR
  },

  onShow() {
    if (!auth.requireLogin()) return
    if (this.data.tab === 'plaza') this.loadFeed()
    else this.loadList()
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'plaza') this.loadFeed()
    else this.loadList()
  },

  onFeedKey(e) {
    const feedKey = e.currentTarget.dataset.key
    if (feedKey === this.data.feedKey) return
    this.setData({ feedKey })
    this.loadFeed()
  },

  async loadList() {
    try {
      const list = await api.fetchOutfits()
      this.setData({
        list: (list || []).map((o) => ootd.toLookCard(o, util.formatDisplayDate))
      })
    } catch (e) {}
  },

  async loadFeed() {
    try {
      const q = ootd.feedQuery(this.data.feedKey)
      const list = await api.fetchOotdFeed(q)
      this.setData({
        feed: (list || []).map((p) => ootd.decorateFeedPost(p, this.data.feedKey))
      })
    } catch (e) {
      this.setData({ feed: [] })
    }
  },

  goCreate() {
    if (!util.ensureLogin()) return
    wx.navigateTo({ url: '/pages/outfit-edit/outfit-edit' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/outfit-detail/outfit-detail?id=${id}` })
  },

  goOotd(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/ootd-detail/ootd-detail?id=${id}` })
  },

  async onLike(e) {
    const id = e.currentTarget.dataset.id
    try {
      const res = await api.likeOotdPost(id)
      const feed = (this.data.feed || []).map((p) =>
        String(p.id) === String(id)
          ? { ...p, liked: !!res.liked, likeCount: Number(res.likeCount) || 0 }
          : p
      )
      this.setData({ feed })
    } catch (err) {}
  }
})
