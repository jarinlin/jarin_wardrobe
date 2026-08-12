const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    id: null,
    item: null,
    clothesCount: 0,
    dateLabel: '',
    shareTitle: '',
    shareText: ''
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.loadDetail()
  },

  async loadDetail() {
    try {
      const item = await api.fetchOutfitDetail(this.data.id)
      const clothes = item.clothes || []
      const count = clothes.length
      const dateLabel = util.formatDisplayDate(item.date)
      const shareTitle = `${dateLabel}穿搭 · ${count}件单品`
      const names = clothes
        .map((c) => c.name)
        .filter(Boolean)
        .slice(0, 6)
        .join('、')
      let shareText = shareTitle
      if (names) shareText += `\n单品：${names}`
      if (item.note) shareText += `\n备注：${item.note}`
      shareText += '\n——来自 Jarin衣柜'
      this.setData({
        item,
        clothesCount: count,
        dateLabel,
        shareTitle,
        shareText
      })
    } catch (e) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const item = this.data.item || {}
    const title = this.data.shareTitle || '我的穿搭'
    const path = `/pages/outfit-detail/outfit-detail?id=${this.data.id}`
    const imageUrl = item.imageUrl || ''
    const payload = { title, path }
    if (imageUrl) payload.imageUrl = imageUrl
    return payload
  },

  onCopyShare() {
    const text = this.data.shareText || this.data.shareTitle
    if (!text) {
      wx.showToast({ title: '暂无可分享内容', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '文案已复制', icon: 'success' })
    })
  },

  onDelete() {
    wx.showModal({
      title: '删除穿搭',
      content: '确定删除这条穿搭记录？',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        await api.deleteOutfit(this.data.id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      }
    })
  }
})
