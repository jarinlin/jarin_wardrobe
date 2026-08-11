const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    date: '',
    dateLabel: '',
    clothes: [],
    selectedIds: [],
    note: '',
    imageUrl: ''
  },

  async onLoad() {
    const date = util.formatDate()
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date)
    })
    await this.loadClothes()
    await this.loadToday()
  },

  async loadClothes() {
    const list = await api.fetchClothes()
    const selectedSet = new Set(this.data.selectedIds.map(String))
    this.setData({
      clothes: list.map((c) => ({
        ...c,
        selected: selectedSet.has(String(c.id))
      }))
    })
  },

  async loadToday() {
    const today = await api.fetchTodayOutfit(this.data.date)
    if (!today) return
    const selectedIds = today.clothingIds || (today.clothes || []).map((c) => c.id)
    this.setData({
      selectedIds,
      note: today.note || '',
      imageUrl: today.imageUrl || ''
    })
    await this.loadClothes()
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date),
      selectedIds: [],
      note: '',
      imageUrl: ''
    })
    this.loadClothes().then(() => this.loadToday())
  },

  toggleCloth(e) {
    const id = e.currentTarget.dataset.id
    let selectedIds = [...this.data.selectedIds]
    const idx = selectedIds.findIndex((x) => String(x) === String(id))
    if (idx >= 0) selectedIds.splice(idx, 1)
    else selectedIds.push(id)
    const selectedSet = new Set(selectedIds.map(String))
    this.setData({
      selectedIds,
      clothes: this.data.clothes.map((c) => ({
        ...c,
        selected: selectedSet.has(String(c.id))
      }))
    })
  },

  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  async onChooseImage() {
    try {
      const paths = await util.chooseImage(1)
      if (paths[0]) this.setData({ imageUrl: paths[0] })
    } catch (e) {}
  },

  async onSubmit() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: '请至少选择一件衣物', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      await api.createOutfit({
        date: this.data.date,
        clothingIds: this.data.selectedIds,
        note: this.data.note,
        imageUrl: this.data.imageUrl
      })
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) {
      wx.hideLoading()
    }
  }
})
