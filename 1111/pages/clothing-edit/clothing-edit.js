const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    id: null,
    categories: [],
    categoryNames: [],
    categoryIndex: 0,
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
    this.setData({ [`form.${key}`]: e.detail.value })
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
      const paths = await util.chooseImage(1)
      if (paths[0]) this.setData({ 'form.imageUrl': paths[0] })
    } catch (e) {}
  },

  async onSubmit() {
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

    wx.showLoading({ title: '保存中' })
    try {
      if (id) await api.updateClothing(id, payload)
      else await api.createClothing(payload)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) {
      wx.hideLoading()
    }
  }
})
