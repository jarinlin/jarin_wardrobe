const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const util = require('../../src/assets/js/util')
const { isBodyReady, promptBodyProfile } = require('../../src/assets/js/diet-metrics')

function todayStr() {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function emptyItem() {
  return { foodName: '', portion: '', calories: '' }
}

function filledItems(items) {
  return (items || []).filter((it) => it.foodName || it.portion || it.calories)
}

function tagSource(items, sourceImage) {
  return (items || []).map((it) => ({ ...it, sourceImage: sourceImage || '' }))
}

function normalizeItems(rawItems, foodName, portion, calories) {
  const list = Array.isArray(rawItems) ? rawItems : []
  const items = list
    .map((it) => {
      if (typeof it === 'string') {
        return { foodName: it, portion: '', calories: '', sourceImage: '' }
      }
      return {
        foodName: (it && it.foodName) || '',
        portion: (it && it.portion) || '',
        calories: it && it.calories != null && it.calories !== '' ? String(it.calories) : '',
        sourceImage: (it && it.sourceImage) || ''
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
    mealDate: '',
    analyzing: false,
    advising: false,
    estimatingIndex: -1,
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
      imageUrls: [],
      advice: '',
      items: [emptyItem()]
    }
  },

  async onLoad(query) {
    if (!util.ensureLogin()) return
    try {
      const body = await api.fetchBodyProfile()
      if (!isBodyReady(body)) {
        promptBodyProfile({ force: true, redirect: true })
        return
      }
    } catch (e) {
      promptBodyProfile({ force: true, redirect: true })
      return
    }
    const id = query.id || null
    const mealDate = query.date || todayStr()
    // 新建：按时段预选餐次；编辑：以详情为准
    const mealType = util.guessMealType()
    this.setData({ id, mealDate, 'form.mealType': mealType })
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
    const imageUrls = Array.isArray(item.imageUrls) && item.imageUrls.length
      ? item.imageUrls.filter(Boolean)
      : (item.imageUrl ? [item.imageUrl] : [])
    const items = normalizeItems(item.items, item.foodName, item.portion, item.calories)
    this.setData({
      form: {
        mealType: item.mealType || 'other',
        imageUrl: imageUrls[0] || '',
        imageUrls,
        advice: '',
        items
      },
      totalCalories: Math.round(calcTotalCalories(items))
    })
  },

  noop() {},

  onMealType(e) {
    this.setData({ 'form.mealType': e.currentTarget.dataset.value })
  },

  onSkipPhoto() {
    wx.pageScrollTo({ selector: '.form', duration: 280 })
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

  onEstimatePortion(e) {
    return this.estimateItem(Number(e.currentTarget.dataset.index), 'portion')
  },

  onEstimateCalories(e) {
    return this.estimateItem(Number(e.currentTarget.dataset.index), 'calories')
  },

  async estimateItem(index, mode) {
    if (this.data.analyzing || this.data.estimatingIndex >= 0) {
      wx.showToast({ title: '估算中，请稍候', icon: 'none' })
      return
    }
    const item = (this.data.form.items || [])[index]
    if (!item) return
    const foodName = (item.foodName || '').trim()
    if (!foodName) {
      wx.showToast({ title: '请先填写菜名', icon: 'none' })
      return
    }
    const busyItems = this.data.form.items.slice()
    busyItems[index] = { ...busyItems[index], estimating: true }
    this.setData({ 'form.items': busyItems, estimatingIndex: index })
    wx.showLoading({ title: mode === 'portion' ? '估算分量' : '估算热量', mask: true })
    try {
      const portionHint = mode === 'portion' ? '' : (item.portion || '').trim()
      const result = await api.estimateFoodCalories(foodName, portionHint)
      const cal = Math.round(Number(result && result.calories) || 0)
      const items = this.data.form.items.slice()
      const next = { ...items[index], estimating: false }
      if (result && result.portion) next.portion = result.portion
      if (cal > 0) next.calories = String(cal)
      items[index] = next
      this.setData({ 'form.items': items })
      this.refreshTotal()
    } catch (err) {
      if (!util.isUserCancel(err)) {
        console.error('[diet-edit] estimateItem', err)
      }
      const items = this.data.form.items.slice()
      if (items[index]) {
        items[index] = { ...items[index], estimating: false }
        this.setData({ 'form.items': items })
      }
    } finally {
      wx.hideLoading()
      this.setData({ estimatingIndex: -1 })
    }
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = this.data.form.imageUrls || []
    if (!current || !urls.length) return
    wx.previewImage({ current, urls })
  },

  onRemoveImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const imageUrls = (this.data.form.imageUrls || []).slice()
    if (index < 0 || index >= imageUrls.length) return
    const removed = imageUrls[index]
    imageUrls.splice(index, 1)
    let items = (this.data.form.items || []).filter((it) => it.sourceImage !== removed)
    if (!filledItems(items).length) items = [emptyItem()]
    const patch = {
      'form.imageUrls': imageUrls,
      'form.imageUrl': imageUrls[0] || '',
      'form.items': items,
      totalCalories: Math.round(calcTotalCalories(items))
    }
    if (!imageUrls.length) {
      patch['form.advice'] = ''
      this.setData(patch)
      return
    }
    this.setData(patch)
    this.regenerateAdviceSilent()
  },

  adviceItems() {
    return (this.data.form.items || [])
      .map((it) => ({
        foodName: (it.foodName || '').trim(),
        portion: (it.portion || '').trim(),
        calories: it.calories === '' || it.calories == null ? 0 : Number(it.calories)
      }))
      .filter((it) => it.foodName)
  },

  async regenerateAdviceSilent() {
    const items = this.adviceItems()
    if (!items.length) {
      this.setData({ 'form.advice': '' })
      return
    }
    if (this.data.analyzing || this.data.advising || this._silentAdvising) return
    this._silentAdvising = true
    try {
      const result = await api.suggestFoodAdvice(items, this.data.form.mealType)
      const advice = (result && result.advice) || ''
      if (advice) this.setData({ 'form.advice': advice })
    } catch (e) {
      if (!util.isUserCancel(e)) {
        console.error('[diet-edit] regenerateAdviceSilent', e)
      }
    } finally {
      this._silentAdvising = false
    }
  },

  async onChooseImage() {
    if (this.data.analyzing) {
      wx.showToast({ title: '识别中，请稍候', icon: 'none' })
      return
    }
    const remain = 9 - ((this.data.form.imageUrls || []).length)
    if (remain <= 0) {
      wx.showToast({ title: '最多 9 张图', icon: 'none' })
      return
    }
    try {
      const urls = await upload.chooseAndUploadImage(remain)
      if (!urls.length) {
        wx.showToast({ title: '未获取到图片', icon: 'none' })
        return
      }
      this._privacyOk = true
      const imageUrls = (this.data.form.imageUrls || []).concat(urls).slice(0, 9)
      this.setData({
        'form.imageUrls': imageUrls,
        'form.imageUrl': imageUrls[0] || ''
      })
      await this.runAnalyze(urls)
    } catch (e) {
      const kind = util.classifyMediaErr(e)
      if (kind === 'privacy' || kind === 'privacy_undeclared') {
        this._privacyOk = false
      }
      if (kind !== 'cancel') {
        console.error('[diet-edit] onChooseImage', kind, e)
      }
    }
  },

  async runAnalyze(imageUrls) {
    const urls = (imageUrls || []).filter(Boolean)
    if (!urls.length || this.data.analyzing) return
    this.setData({ analyzing: true })
    wx.showLoading({ title: 'AI 识别中', mask: true })
    try {
      let items = filledItems(this.data.form.items)
      let advice = this.data.form.advice || ''
      for (const url of urls) {
        const result = await api.analyzeFood([url], this.data.form.mealType)
        const aiItems = tagSource(
          normalizeItems(result.items, result.foodName, result.portion, result.calories),
          url
        )
        items = items.concat(aiItems)
        if (!advice && result.advice) advice = result.advice
      }
      if (!items.length) items = [emptyItem()]
      this.setData({
        'form.items': items,
        'form.advice': advice,
        totalCalories: Math.round(calcTotalCalories(items))
      })
    } catch (e) {
      if (!util.isUserCancel(e)) {
        console.error('[diet-edit] runAnalyze', e)
      }
    } finally {
      wx.hideLoading()
      this.setData({ analyzing: false })
    }
  },

  async onGenerateAdvice() {
    if (this.data.analyzing || this.data.advising) {
      wx.showToast({ title: '请稍候', icon: 'none' })
      return
    }
    const items = this.adviceItems()
    if (!items.length) {
      wx.showToast({ title: '请先填写菜品', icon: 'none' })
      return
    }
    this.setData({ advising: true })
    wx.showLoading({ title: '生成建议', mask: true })
    try {
      const result = await api.suggestFoodAdvice(items, this.data.form.mealType)
      const advice = (result && result.advice) || ''
      if (!advice) {
        wx.showToast({ title: '未生成建议', icon: 'none' })
        return
      }
      this.setData({ 'form.advice': advice })
    } catch (e) {
      if (!util.isUserCancel(e)) {
        console.error('[diet-edit] onGenerateAdvice', e)
      }
    } finally {
      wx.hideLoading()
      this.setData({ advising: false })
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
    if (!items.length || !items.some((it) => it.foodName)) {
      wx.showToast({ title: '请至少填写一道菜名', icon: 'none' })
      return
    }
    const total = items.reduce((s, it) => s + (Number.isFinite(it.calories) ? it.calories : 0), 0)
    const imageUrls = form.imageUrls || (form.imageUrl ? [form.imageUrl] : [])
    const payload = {
      mealType: form.mealType,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      items,
      foodName: items.map((it) => it.foodName).filter(Boolean).join('+'),
      portion: items.length ? `共${items.length}道` : '',
      calories: total
    }
    if (!id) {
      const mealDate = this.data.mealDate || todayStr()
      payload.mealAt = mealDate === todayStr()
        ? new Date().toISOString()
        : mealDate + 'T12:00:00+08:00'
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
      content: (this.data.form.imageUrls || []).length ? '将同步删除云端图片' : '删除后无法恢复',
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
