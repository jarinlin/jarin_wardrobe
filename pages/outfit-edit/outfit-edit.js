const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const upload = require('../../src/assets/js/upload')

Page({
  data: {
    date: '',
    dateLabel: '',
    clothes: [],
    selectedIds: [],
    note: '',
    imageUrl: ''
  },

  async onLoad(query) {
    const date = util.formatDate()
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date)
    })
    this._fromSuggest = String((query && query.fromSuggest) || '') === '1'
    await this.loadClothes()
    await this.loadToday()
    this.applySuggestPrefill()
  },

  applySuggestPrefill() {
    if (!this._fromSuggest) return
    let ids = []
    let note = ''
    try {
      ids = wx.getStorageSync('suggest_outfit_ids') || []
      note = wx.getStorageSync('suggest_outfit_note') || ''
      wx.removeStorageSync('suggest_outfit_ids')
      wx.removeStorageSync('suggest_outfit_note')
    } catch (e) {}
    if (!ids.length) return

    // 今日已有记录时合并建议（去重），备注为空则用建议文案
    const merged = []
    const seen = new Set()
    ;[...ids, ...(this.data.selectedIds || [])].forEach((id) => {
      const key = String(id)
      if (seen.has(key)) return
      seen.add(key)
      merged.push(id)
    })
    const selectedSet = new Set(merged.map(String))
    this.setData({
      selectedIds: merged,
      note: (this.data.note || '').trim() ? this.data.note : note,
      clothes: (this.data.clothes || []).map((c) => ({
        ...c,
        selected: selectedSet.has(String(c.id))
      }))
    })
    wx.showToast({ title: '已带入今日建议', icon: 'none' })
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
      const urls = await upload.chooseAndUploadImage(1)
      if (urls[0]) this.setData({ imageUrl: urls[0] })
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
