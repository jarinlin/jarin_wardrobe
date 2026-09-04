const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')
const ootd = require('../../src/assets/js/ootd')

const PAGE_SIZE = 12

Page({
  data: {
    loggedIn: false,
    tab: 'mine',
    list: [],
    feed: [],
    feedKey: 'week',
    page: 1,
    hasMore: true,
    loadingMore: false,
    defaultAvatar: ootd.DEFAULT_AVATAR
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ list: [], feed: [], page: 1, hasMore: true, loadingMore: false })
      return
    }
    if (this.data.tab === 'plaza') this.loadFeed()
    else this.loadList()
  },

  onPullDownRefresh() {
    const p = this.data.tab === 'plaza' ? this.loadFeed() : this.loadList()
    Promise.resolve(p).finally(() => wx.stopPullDownRefresh())
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (!this.data.loggedIn) return
    if (tab === 'plaza') this.loadFeed()
    else this.loadList()
  },

  onFeedKey(e) {
    const feedKey = e.currentTarget.dataset.key
    if (feedKey === this.data.feedKey) return
    this.setData({ feedKey })
    if (!this.data.loggedIn) return
    this.loadFeed()
  },

  async loadList(opts) {
    const reset = !opts || opts.reset !== false
    if (this._loadingList) return
    if (!reset && (!this.data.hasMore || this.data.loadingMore)) return
    const page = reset ? 1 : this.data.page
    this._loadingList = true
    if (!reset) this.setData({ loadingMore: true })
    try {
      const data = await api.fetchOutfits({ page, pageSize: PAGE_SIZE })
      const chunk = (data.list || []).map((o) => ootd.toLookCard(o, util.formatDisplayDate))
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
    if (this.data.tab === 'mine') this.loadList({ reset: false })
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
    if (!util.ensureLogin()) return
    const id = e.currentTarget.dataset.id
    try {
      const res = await api.likeOotdPost(id)
      const feed = (this.data.feed || []).map((p) =>
        String(p.id) === String(id)
          ? { ...p, liked: !!res.liked, likeCount: Number(res.likeCount) || 0 }
          : p
      )
      this.setData({ feed })
    } catch (err) {
      wx.showToast({ title: '点赞失败', icon: 'none' })
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
