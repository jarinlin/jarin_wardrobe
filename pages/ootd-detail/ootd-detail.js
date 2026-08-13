const api = require('../../src/assets/js/api')
const ootd = require('../../src/assets/js/ootd')

Page({
  data: {
    id: null,
    post: null,
    defaultAvatar: ootd.DEFAULT_AVATAR
  },

  onLoad(query) {
    this.setData({ id: query.id })
  },

  onShow() {
    if (this.data.id) this.loadDetail()
  },

  async loadDetail() {
    try {
      const post = ootd.decorateFeedPost(await api.fetchOotdPost(this.data.id), 'new')
      this.setData({ post })
    } catch (e) {
      wx.showToast({ title: '帖子不存在', icon: 'none' })
    }
  },

  async onLike() {
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
    } catch (e) {}
  },

  goManage() {
    const post = this.data.post || {}
    if (!post.outfitId) return
    wx.navigateTo({
      url: `/pages/ootd-publish/ootd-publish?outfitId=${post.outfitId}&postId=${post.id}`
    })
  }
})
