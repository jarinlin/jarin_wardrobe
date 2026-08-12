const api = require('../../src/assets/js/api')

Page({
  data: {
    form: {
      gender: 'female',
      age: '',
      heightCm: '',
      weightKg: ''
    },
    metrics: {}
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const body = await api.fetchBodyProfile()
      this.setData({
        form: {
          gender: body.gender || 'female',
          age: body.age ? String(body.age) : '',
          heightCm: body.heightCm ? String(body.heightCm) : '',
          weightKg: body.weightKg ? String(body.weightKg) : ''
        },
        metrics: body.metrics || {}
      })
    } catch (e) {}
  },

  onGender(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.v })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  async onSave() {
    const { form } = this.data
    const heightCm = Number(form.heightCm)
    const weightKg = Number(form.weightKg)
    const age = Number(form.age) || 0
    if (!heightCm || !weightKg) {
      wx.showToast({ title: '请填写身高体重', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      const body = await api.saveBodyProfile({
        gender: form.gender,
        age,
        heightCm,
        weightKg
      })
      this.setData({ metrics: body.metrics || {} })
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
    }
  }
})
