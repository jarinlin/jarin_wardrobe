const api = require('../../src/assets/js/api')
const ootd = require('../../src/assets/js/ootd')
const util = require('../../src/assets/js/util')
const auth = require('../../src/assets/js/auth')

Page({
  data: {
    loggedIn: false,
    id: null,
    post: null,
    loadError: false,
    defaultAvatar: ootd.DEFAULT_AVATAR
  },

  onLoad(query) {
    this.setData({ id: query.id })
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ post: null, loadError: false })
      return
    }
    if (this.data.id) this.loadDetail()
  },

  async loadDetail() {
    try {
      const post = ootd.decorateFeedPost(await api.fetchOotdPost(this.data.id), 'new')
      this.setData({ post, loadError: false })
    } catch (e) {
      this.setData({ post: null, loadError: true })
      wx.showToast({ title: '帖子不存在', icon: 'none' })
    }
  },

  async onLike() {
    if (!util.ensureLogin()) return
    const post = this.data.post
    if (!post) return
    try {
      const res = await api.likeOotdPost(post.id)
      this.setData({
        post: {
          ...post,
          liked: !!res.liked,
          likeCount: Number(res.likeCount) || 0
        }
      })
    } catch (e) {
      wx.showToast({ title: '点赞失败', icon: 'none' })
    }
  },

  goManage() {
    if (!util.ensureLogin()) return
    const post = this.data.post || {}
    if (!post.outfitId) return
    wx.navigateTo({
      url: `/pages/ootd-publish/ootd-publish?outfitId=${post.outfitId}&postId=${post.id}`
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
