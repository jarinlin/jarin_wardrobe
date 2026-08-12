const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')

function guessMealType() {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'other'
}

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

Page({
  data: {
    id: null,
    analyzing: false,
    mealTypes: [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'dinner', label: '晚餐' },
      { value: 'other', label: '其他' }
    ],
    form: {
      mealType: 'lunch',
      imageUrl: '',
      foodName: '',
      portion: '',
      calories: '',
      advice: ''
    }
  },

  async onLoad(query) {
    const id = query.id || null
    const mealType = guessMealType()
    this.setData({ id, 'form.mealType': mealType })
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑饮食' })
      await this.loadDetail(id)
    }
  },

  async loadDetail(id) {
    const item = await api.fetchDietDetail(id)
    this.setData({
      form: {
        mealType: item.mealType || 'other',
        imageUrl: item.imageUrl || '',
        foodName: item.foodName || '',
        portion: item.portion || '',
        calories: item.calories != null ? String(item.calories) : '',
        advice: item.advice || ''
      }
    })
  },

  onMealType(e) {
    this.setData({ 'form.mealType': e.currentTarget.dataset.value })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  async onChooseImage() {
    try {
      const urls = await upload.chooseAndUploadImage(1)
      if (!urls[0]) return
      this.setData({ 'form.imageUrl': urls[0] })
      await this.runAnalyze(urls[0])
    } catch (e) {}
  },

  async runAnalyze(imageUrl) {
    if (!imageUrl || this.data.analyzing) return
    this.setData({ analyzing: true })
    wx.showLoading({ title: 'AI 识别中', mask: true })
    try {
      const result = await api.analyzeFood(imageUrl, this.data.form.mealType)
      const form = { ...this.data.form }
      if (isEmpty(form.foodName) && result.foodName) form.foodName = result.foodName
      if (isEmpty(form.portion) && result.portion) form.portion = result.portion
      if (isEmpty(form.calories) && result.calories != null) form.calories = String(result.calories)
      if (isEmpty(form.advice) && result.advice) form.advice = result.advice
      this.setData({ form })
    } catch (e) {
    } finally {
      wx.hideLoading()
      this.setData({ analyzing: false })
    }
  },

  async onSubmit() {
    const { form, id } = this.data
    if (!form.imageUrl && !form.foodName) {
      wx.showToast({ title: '请拍照或填写食物', icon: 'none' })
      return
    }
    const payload = {
      mealType: form.mealType,
      imageUrl: form.imageUrl,
      foodName: (form.foodName || '').trim(),
      portion: (form.portion || '').trim(),
      calories: form.calories === '' ? 0 : Number(form.calories),
      advice: (form.advice || '').trim(),
      mealAt: new Date().toISOString()
    }
    wx.showLoading({ title: '保存中' })
    try {
      if (id) await api.updateDietLog(id, payload)
      else await api.createDietLog(payload)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) {
      wx.hideLoading()
    }
  },

  onDelete() {
    const id = this.data.id
    wx.showModal({
      title: '删除记录',
      content: '将同步删除云端图片',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        await api.deleteDietLog(id)
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 300)
      }
    })
  }
})
