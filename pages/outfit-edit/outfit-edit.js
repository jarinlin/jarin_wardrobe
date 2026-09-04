const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const upload = require('../../src/assets/js/upload')

const PAGE_SIZE = 24

Page({
  data: {
    date: '',
    dateLabel: '',
    clothes: [],
    clothesPage: 1,
    clothesHasMore: true,
    loadingMore: false,
    selectedIds: [],
    note: '',
    imageUrl: '',
    ootdPublished: false,
    ootdPostId: 0,
    hasRecord: false,
    submitting: false
  },

  async onLoad(query) {
    if (!util.ensureLogin()) return
    this._fromSuggest = String((query && query.fromSuggest) || '') === '1'
    this._editId = (query && query.id) || ''
    const date = (query && query.date) || util.formatDate()
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date)
    })
    await this.loadClothes()
    if (this._editId) await this.loadById(this._editId)
    else await this.loadByDate(date)
    this.applySuggestPrefill()
    this.syncTitle()
  },

  syncTitle() {
    wx.setNavigationBarTitle({
      title: this.data.hasRecord ? '编辑穿搭' : '记录穿搭'
    })
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
    const selectedSet = new Set(ids.map(String))
    this.setData({
      selectedIds: ids,
      note: (this.data.note || '').trim() ? this.data.note : note,
      clothes: (this.data.clothes || []).map((c) => ({
        ...c,
        selected: selectedSet.has(String(c.id))
      }))
    })
    this.ensureSelectedVisible()
    wx.showToast({ title: '已带入今日建议', icon: 'none' })
  },

  applyOutfit(item) {
    if (!item) {
      this.setData({
        selectedIds: [],
        note: '',
        imageUrl: '',
        ootdPublished: false,
        ootdPostId: 0,
        hasRecord: false
      })
      return this.loadClothes()
    }
    const date = item.date || this.data.date
    const selectedIds = item.clothingIds || (item.clothes || []).map((c) => c.id)
    this._editId = item.id || this._editId
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date),
      selectedIds,
      note: item.note || '',
      imageUrl: item.imageUrl || '',
      ootdPublished: !!item.ootdPublished,
      ootdPostId: item.ootdPostId || 0,
      hasRecord: true
    })
    return this.loadClothes()
  },

  markSelected(list) {
    const selectedSet = new Set((this.data.selectedIds || []).map(String))
    return (list || []).map((c) => ({
      ...c,
      selected: selectedSet.has(String(c.id))
    }))
  },

  async ensureSelectedVisible() {
    const selected = this.data.selectedIds || []
    if (!selected.length) return
    const have = new Set((this.data.clothes || []).map((c) => String(c.id)))
    const missing = selected.filter((id) => !have.has(String(id)))
    if (!missing.length) return
    try {
      const extra = await api.fetchClothes({ ids: missing.join(',') })
      const extras = this.markSelected(extra.list || extra)
      this.setData({ clothes: extras.concat(this.data.clothes || []) })
    } catch (e) {}
  },

  async loadClothes(opts) {
    const reset = !opts || opts.reset !== false
    if (this._loadingClothes) return
    if (!reset && (!this.data.clothesHasMore || this.data.loadingMore)) return
    const page = reset ? 1 : this.data.clothesPage
    this._loadingClothes = true
    if (!reset) this.setData({ loadingMore: true })
    try {
      const data = await api.fetchClothes({ page, pageSize: PAGE_SIZE })
      const chunk = this.markSelected(data.list || [])
      const have = new Set()
      const merged = reset ? chunk : (this.data.clothes || []).concat(chunk)
      const clothes = merged.filter((c) => {
        const key = String(c.id)
        if (have.has(key)) return false
        have.add(key)
        return true
      })
      this.setData({
        clothes,
        clothesPage: page + 1,
        clothesHasMore: !!data.hasMore,
        loadingMore: false
      })
      if (reset) await this.ensureSelectedVisible()
    } catch (e) {
      this.setData({ loadingMore: false })
    } finally {
      this._loadingClothes = false
    }
  },

  onReachBottom() {
    this.loadClothes({ reset: false })
  },

  async loadById(id) {
    try {
      const item = await api.fetchOutfitDetail(id)
      await this.applyOutfit(item)
    } catch (e) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
    }
  },

  async loadByDate(date) {
    const item = await api.fetchTodayOutfit(date)
    await this.applyOutfit(item || null)
  },

  onDateChange(e) {
    const date = e.detail.value
    this._editId = ''
    this.setData({
      date,
      dateLabel: util.formatDisplayDate(date)
    })
    this.loadByDate(date).then(() => this.syncTitle())
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
    } catch (e) {
      util.toastChooseImageFail(e)
    }
  },

  async onSubmit(e) {
    if (this.data.submitting) return
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: '请至少选择一件衣物', icon: 'none' })
      return
    }
    const goPlaza = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.plaza) || '') === '1'
    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中' })
    try {
      const saved = await api.createOutfit({
        date: this.data.date,
        clothingIds: this.data.selectedIds,
        note: this.data.note,
        imageUrl: this.data.imageUrl
      })
      wx.hideLoading()
      if (goPlaza && saved && saved.id) {
        const postId = saved.ootdPostId || this.data.ootdPostId || ''
        wx.redirectTo({
          url: `/pages/ootd-publish/ootd-publish?outfitId=${saved.id}&postId=${postId}`
        })
        return
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack({
          fail: () => this.setData({ submitting: false })
        })
      }, 400)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  }
})
