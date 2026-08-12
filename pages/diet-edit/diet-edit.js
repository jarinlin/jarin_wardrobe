const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const util = require('../../src/assets/js/util')

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

function emptyItem() {
  return { foodName: '', portion: '', calories: '' }
}

function normalizeItems(rawItems, foodName, portion, calories) {
  const list = Array.isArray(rawItems) ? rawItems : []
  const items = list
    .map((it) => {
      if (typeof it === 'string') {
        return { foodName: it, portion: '', calories: '' }
      }
      return {
        foodName: (it && it.foodName) || '',
        portion: (it && it.portion) || '',
        calories: it && it.calories != null && it.calories !== '' ? String(it.calories) : ''
      }
    })
    .filter((it) => it.foodName || it.portion || it.calories)
  if (!items.length && (foodName || portion || calories)) {
    items.push({
      foodName: foodName || '',
      portion: portion || '',
      calories: calories != null && calories !== '' ? String(calories) : ''
    })
  }
  if (!items.length) items.push(emptyItem())
  return items
}

function calcTotalCalories(items) {
  return (items || []).reduce((sum, it) => {
    const n = Number(it.calories)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

Page({
  data: {
    id: null,
    analyzing: false,
    // 新建默认隐藏；有图或已有 advice 时再显示
    showAdvice: false,
    totalCalories: 0,
    mealTypes: [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'dinner', label: '晚餐' },
      { value: 'other', label: '其他' }
    ],
    form: {
      mealType: 'other',
      imageUrl: '',
      advice: '',
      items: [emptyItem()]
    }
  },

  async onLoad(query) {
    const id = query.id || null
    // 新建：按时段预选餐次；编辑：以详情为准
    const mealType = util.guessMealType()
    this.setData({ id, 'form.mealType': mealType })
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑饮食' })
      await this.loadDetail(id)
    } else {
      this.refreshTotal()
    }
    // 进入页即预拉隐私（失败不打扰；点上传时会再鉴权并 toast）
    this.warmupPrivacy()
  },

  warmupPrivacy() {
    util
      .requirePrivacyAuthorize({ continueOnFail: true })
      .then((r) => {
        this._privacyOk = !!(r && r.ok !== false)
      })
      .catch(() => {
        this._privacyOk = false
      })
  },

  refreshTotal() {
    this.setData({ totalCalories: Math.round(calcTotalCalories(this.data.form.items)) })
  },

  async loadDetail(id) {
    const item = await api.fetchDietDetail(id)
    const imageUrl = item.imageUrl || ''
    const advice = item.advice || ''
    const items = normalizeItems(item.items, item.foodName, item.portion, item.calories)
    this.setData({
      showAdvice: !!(imageUrl || !isEmpty(advice)),
      form: {
        mealType: item.mealType || 'other',
        imageUrl,
        advice,
        items
      },
      totalCalories: Math.round(calcTotalCalories(items))
    })
  },

  noop() {},

  onMealType(e) {
    this.setData({ 'form.mealType': e.currentTarget.dataset.value })
  },

  onAdviceInput(e) {
    this.setData({ 'form.advice': e.detail.value })
  },

  onItemInput(e) {
    const { index, key } = e.currentTarget.dataset
    const items = this.data.form.items.slice()
    items[index] = { ...items[index], [key]: e.detail.value }
    this.setData({ 'form.items': items })
    if (key === 'calories') this.refreshTotal()
  },

  onAddItem() {
    const items = this.data.form.items.concat([emptyItem()])
    this.setData({ 'form.items': items })
  },

  onRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    let items = this.data.form.items.slice()
    if (items.length <= 1) {
      items = [emptyItem()]
    } else {
      items.splice(index, 1)
    }
    this.setData({ 'form.items': items })
    this.refreshTotal()
  },

  async onChooseImage() {
    if (this.data.analyzing) {
      wx.showToast({ title: '识别中，请稍候', icon: 'none' })
      return
    }
    try {
      // util.chooseImage 内会先 requirePrivacyAuthorize，再选图；失败按 privacy/denied/cancel 区分 toast
      const urls = await upload.chooseAndUploadImage(1)
      if (!urls[0]) {
        wx.showToast({ title: '未获取到图片', icon: 'none' })
        return
      }
      this._privacyOk = true
      // 上传图片后即展示饮食建议区，便于查看/编辑 AI 回填
      this.setData({ 'form.imageUrl': urls[0], showAdvice: true })
      await this.runAnalyze(urls[0])
    } catch (e) {
      // util.chooseImage / uploadImage 已 toast；用户取消静默
      const kind = util.classifyMediaErr(e)
      if (kind === 'privacy' || kind === 'privacy_undeclared') {
        this._privacyOk = false
      }
      if (kind !== 'cancel') {
        console.error('[diet-edit] onChooseImage', kind, e)
      }
    }
  },

  async runAnalyze(imageUrl) {
    if (!imageUrl || this.data.analyzing) return
    this.setData({ analyzing: true })
    wx.showLoading({ title: 'AI 识别中', mask: true })
    try {
      const result = await api.analyzeFood(imageUrl, this.data.form.mealType)
      const form = { ...this.data.form }
      const aiItems = normalizeItems(result.items, result.foodName, result.portion, result.calories)
      // 识别结果优先回填整表 items（空表或仅空白行时）
      const current = (form.items || []).filter((it) => it.foodName || it.portion || it.calories)
      if (!current.length) {
        form.items = aiItems
      } else if (result.items && result.items.length) {
        form.items = aiItems
      }
      if (isEmpty(form.advice) && result.advice) form.advice = result.advice
      this.setData({
        form,
        showAdvice: !!(form.imageUrl || !isEmpty(form.advice)),
        totalCalories: Math.round(calcTotalCalories(form.items))
      })
    } catch (e) {
      // api.request 通常已 toast；兜底提示
      if (!util.isUserCancel(e)) {
        console.error('[diet-edit] runAnalyze', e)
      }
    } finally {
      wx.hideLoading()
      this.setData({ analyzing: false })
    }
  },

  async onSubmit() {
    const { form, id } = this.data
    const items = (form.items || [])
      .map((it) => ({
        foodName: (it.foodName || '').trim(),
        portion: (it.portion || '').trim(),
        calories: it.calories === '' || it.calories == null ? 0 : Number(it.calories)
      }))
      .filter((it) => it.foodName || it.portion || it.calories)
    if (!form.imageUrl && !items.length) {
      wx.showToast({ title: '请拍照或添加一道菜', icon: 'none' })
      return
    }
    const total = items.reduce((s, it) => s + (Number.isFinite(it.calories) ? it.calories : 0), 0)
    const payload = {
      mealType: form.mealType,
      imageUrl: form.imageUrl,
      items,
      foodName: items.map((it) => it.foodName).filter(Boolean).join('+'),
      portion: items.length ? `共${items.length}道` : '',
      calories: total,
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
