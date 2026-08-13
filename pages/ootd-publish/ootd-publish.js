const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const ootd = require('../../src/assets/js/ootd')
const util = require('../../src/assets/js/util')

Page({
  data: {
    ready: false,
    outfitId: '',
    postId: '',
    published: false,
    outfit: {},
    hasImage: false,
    photoUrl: '',
    showCover: false,
    showPhoto: false,
    showCaption: false,
    showItems: true,
    caption: '',
    itemTags: [],
    itemCount: 0,
    canSubmit: false,
    showBelow: false,
    submitting: false,
    author: { nickname: '我', avatarUrl: '' },
    defaultAvatar: ootd.DEFAULT_AVATAR
  },

  onLoad(query) {
    if (!util.ensureLogin()) return
    this.setData({
      outfitId: query.outfitId || '',
      postId: query.postId || ''
    })
    this.bootstrap()
  },

  async bootstrap() {
    const user = auth.getUserInfo() || {}
    this.setData({
      author: {
        nickname: user.nickname || '我',
        avatarUrl: user.avatarUrl || ''
      }
    })
    try {
      const outfit = await api.fetchOutfitDetail(this.data.outfitId)
      const clothes = outfit.clothes || []
      const itemTags = clothes
        .map((c) => (c && c.name) || '')
        .filter(Boolean)
        .map((name, i) => ({ i, name }))
      const hasImage = !!outfit.imageUrl
      let showPhoto = hasImage
      let showCaption = !!(outfit.note || '').trim()
      let showItems = true
      let caption = outfit.note || ''
      let postId = this.data.postId
      let published = !!outfit.ootdPublished

      try {
        const mine = await api.fetchOotdMine(this.data.outfitId)
        if (mine && mine.postId) {
          postId = mine.postId
          published = !!mine.published
          const post = mine.post || {}
          if (typeof post.showPhoto === 'boolean') showPhoto = post.showPhoto && hasImage
          if (typeof post.showCaption === 'boolean') showCaption = post.showCaption
          if (typeof post.showItems === 'boolean') showItems = post.showItems
          if (post.captionDraft != null) caption = post.captionDraft
          else if (post.caption) caption = post.caption
        }
      } catch (e) {}

      const canSubmit = ootd.hasPublishContent(
        showPhoto,
        showCaption,
        showItems,
        hasImage,
        caption,
        itemTags.length
      )
      const showCover = showPhoto && hasImage
      this.setData({
        ready: true,
        outfit,
        hasImage,
        photoUrl: outfit.imageUrl || '',
        itemTags,
        itemCount: itemTags.length,
        showPhoto,
        showCaption,
        showItems,
        caption,
        postId,
        published,
        canSubmit,
        showCover,
        showBelow:
          showCover && (showCaption || (showItems && itemTags.length > 0) || !canSubmit)
      })
    } catch (e) {
      wx.showToast({ title: '穿搭不存在', icon: 'none' })
    }
  },

  refreshCanSubmit() {
    const canSubmit = ootd.hasPublishContent(
      this.data.showPhoto,
      this.data.showCaption,
      this.data.showItems,
      this.data.hasImage,
      this.data.caption,
      this.data.itemCount
    )
    const showCover = this.data.showPhoto && this.data.hasImage
    this.setData({
      canSubmit,
      showCover,
      showBelow:
        showCover &&
        (this.data.showCaption || (this.data.showItems && this.data.itemCount > 0) || !canSubmit)
    })
  },

  onPhoto(e) {
    if (!this.data.hasImage) return
    this.setData({ showPhoto: !!e.detail.value })
    this.refreshCanSubmit()
  },

  onCaptionSwitch(e) {
    this.setData({ showCaption: !!e.detail.value })
    this.refreshCanSubmit()
  },

  onItems(e) {
    this.setData({ showItems: !!e.detail.value })
    this.refreshCanSubmit()
  },

  onCaptionInput(e) {
    this.setData({ caption: e.detail.value || '' })
    this.refreshCanSubmit()
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.canSubmit) {
      wx.showToast({ title: '至少打开一项有内容的', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const payload = {
      outfitId: Number(this.data.outfitId),
      showPhoto: this.data.showPhoto && this.data.hasImage,
      showCaption: this.data.showCaption,
      showItems: this.data.showItems,
      caption: this.data.caption
    }
    try {
      if (this.data.published && this.data.postId) {
        await api.updateOotdPost(this.data.postId, payload)
        wx.showToast({ title: '已更新', icon: 'success' })
      } else {
        const post = await api.createOotdPost(payload)
        this.setData({
          published: true,
          postId: post && post.id ? post.id : this.data.postId
        })
        wx.showToast({ title: '已发布', icon: 'success' })
      }
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) {
      this.setData({ submitting: false })
    }
  },

  onWithdraw() {
    if (!this.data.postId) return
    wx.showModal({
      title: '从广场撤回',
      content: '撤回后私人记录还在，随时可以再发。',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.updateOotdPost(this.data.postId, { status: 'withdrawn' })
          wx.showToast({ title: '已撤回', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 400)
        } catch (e) {}
      }
    })
  }
})
