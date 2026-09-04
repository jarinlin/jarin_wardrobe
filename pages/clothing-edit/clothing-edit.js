const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const util = require('../../src/assets/js/util')

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

Page({
  data: {
    id: null,
    categories: [],
    categoryNames: [],
    categoryIndex: 0,
    analyzing: false,
    submitting: false,
    priceEstimated: false,
    priceNote: '',
    form: {
      name: '',
      categoryId: null,
      brand: '',
      color: '',
      size: '',
      buyDate: '',
      price: '',
      remark: '',
      imageUrl: ''
    }
  },

  async onLoad(query) {
    if (!util.ensureLogin()) return
    const id = query.id || null
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑衣物' })
    }
    this.setData({ id })
    await this.loadCategories()
    if (id) await this.loadDetail(id)
  },

  async loadCategories() {
    const categories = await api.fetchCategories()
    const categoryNames = categories.map((c) => c.name)
    const form = this.data.form
    if (!form.categoryId && categories[0]) {
      form.categoryId = categories[0].id
    }
    this.setData({ categories, categoryNames, form })
  },

  async loadDetail(id) {
    const item = await api.fetchClothingDetail(id)
    const categoryIndex = Math.max(
      0,
      this.data.categories.findIndex((c) => String(c.id) === String(item.categoryId))
    )
    this.setData({
      categoryIndex,
      priceEstimated: false,
      priceNote: '',
      form: {
        name: item.name || '',
        categoryId: item.categoryId,
        brand: item.brand || '',
        color: item.color || '',
        size: item.size || '',
        buyDate: item.buyDate || '',
        price: item.price != null ? String(item.price) : '',
        remark: item.remark || '',
        imageUrl: item.imageUrl || ''
      }
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    const patch = { [`form.${key}`]: e.detail.value }
    if (key === 'price') {
      patch.priceEstimated = false
      patch.priceNote = ''
    }
    this.setData(patch)
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value)
    const cat = this.data.categories[categoryIndex]
    this.setData({
      categoryIndex,
      'form.categoryId': cat ? cat.id : null
    })
  },

  onDateChange(e) {
    this.setData({ 'form.buyDate': e.detail.value })
  },

  async onChooseImage() {
    try {
      const urls = await upload.chooseAndUploadImage(1)
      if (!urls[0]) return
      this.setData({
        'form.imageUrl': urls[0],
        priceEstimated: false,
        priceNote: ''
      })
      await this.runAnalyze(urls[0])
    } catch (e) {
      util.toastChooseImageFail(e)
    }
  },

  async runAnalyze(imageUrl) {
    if (!imageUrl || this.data.analyzing) return
    this.setData({ analyzing: true })
    wx.showLoading({ title: 'AI 识别中', mask: true })
    try {
      const result = await api.analyzeClothing(imageUrl)
      this.applyAnalyzeResult(result)
    } catch (e) {
      // api.request 已 toast；保留手填
    } finally {
      wx.hideLoading()
      this.setData({ analyzing: false })
    }
  },

  applyAnalyzeResult(result) {
    if (!result) return
    const form = { ...this.data.form }
    const patch = {}

    if (isEmpty(form.name) && result.name) form.name = result.name
    if (isEmpty(form.brand) && result.brand) form.brand = result.brand
    if (isEmpty(form.color) && result.color) form.color = result.color
    if (isEmpty(form.size) && result.size) form.size = result.size
    if (isEmpty(form.price) && result.price != null && result.price !== '') {
      form.price = String(result.price)
      patch.priceEstimated = !!result.priceEstimated
      patch.priceNote = result.priceNote || (result.priceEstimated ? '估算参考，可修改' : '')
    }

    // 换图识别时采用 AI 分类（用户之后仍可改 picker）
    if (result.categoryId != null) {
      const idx = this.data.categories.findIndex((c) => String(c.id) === String(result.categoryId))
      if (idx >= 0) {
        form.categoryId = result.categoryId
        patch.categoryIndex = idx
      }
    }

    patch.form = form
    this.setData(patch)
  },

  async onSubmit() {
    if (this.data.submitting || this.data.analyzing) return
    const { form, id } = this.data
    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请填写名称', icon: 'none' })
      return
    }
    if (!form.categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      price: form.price === '' ? 0 : Number(form.price)
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中' })
    try {
      if (id) await api.updateClothing(id, payload)
      else await api.createClothing(payload)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  }
})
