const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    form: {
      gender: 'female',
      birthDate: '',
      age: '',
      heightCm: '',
      weightKg: ''
    },
    birthLabel: '',
    startDate: '1920-01-01',
    endDate: util.formatDate(),
    metrics: {}
  },

  onShow() {
    this.setData({ endDate: util.formatDate() })
    this.load()
  },

  async load() {
    try {
      const body = await api.fetchBodyProfile()
      const birthDate = body.birthDate || ''
      const age = birthDate
        ? util.ageFromBirthDate(birthDate)
        : (body.age ? Number(body.age) : 0)
      this.setData({
        form: {
          gender: body.gender || 'female',
          birthDate,
          age: age ? String(age) : '',
          heightCm: body.heightCm ? String(body.heightCm) : '',
          weightKg: body.weightKg ? String(body.weightKg) : ''
        },
        birthLabel: birthDate ? util.formatDisplayDate(birthDate) : '',
        metrics: body.metrics || {}
      })
    } catch (e) {}
  },

  onGender(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.v })
  },

  onBirthChange(e) {
    const birthDate = e.detail.value
    const age = util.ageFromBirthDate(birthDate)
    this.setData({
      'form.birthDate': birthDate,
      'form.age': age ? String(age) : '',
      birthLabel: util.formatDisplayDate(birthDate)
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  async onSave() {
    const { form } = this.data
    const heightCm = Number(form.heightCm)
    const weightKg = Number(form.weightKg)
    if (!form.birthDate) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }
    const age = util.ageFromBirthDate(form.birthDate)
    if (!age) {
      wx.showToast({ title: '出生日期不合法', icon: 'none' })
      return
    }
    if (!heightCm || !weightKg) {
      wx.showToast({ title: '请填写身高体重', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      const body = await api.saveBodyProfile({
        gender: form.gender,
        birthDate: form.birthDate,
        age,
        heightCm,
        weightKg
      })
      this.setData({
        metrics: body.metrics || {},
        'form.age': body.age ? String(body.age) : String(age),
        'form.birthDate': body.birthDate || form.birthDate,
        birthLabel: util.formatDisplayDate(body.birthDate || form.birthDate)
      })
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
    }
  }
})
