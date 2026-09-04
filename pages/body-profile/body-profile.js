const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')
const { targetRows } = require('../../src/assets/js/diet-metrics')

const ACTIVITY_HINTS = {
  sedentary: '长时间坐着办公，很少运动',
  light: '散步、家务等轻度活动',
  moderate: '每周规律运动 3–5 次',
  heavy: '体力工作或高强度训练'
}

const GOAL_HINTS = {
  cut: '相对消耗适度少吃，不极端节食',
  maintain: '按活动量贴近每日消耗',
  bulk: '相对消耗适度多吃，不暴增'
}

function normalizeGender(v) {
  if (v === 'male' || v === '男' || v === 'm') return 'male'
  if (v === 'female' || v === '女' || v === 'f') return 'female'
  return ''
}

function normalizeGoal(v) {
  if (v === 'cut' || v === 'fat_loss' || v === '减脂') return 'cut'
  if (v === 'maintain' || v === '维持') return 'maintain'
  if (v === 'bulk' || v === 'muscle_gain' || v === '增肌') return 'bulk'
  return ''
}

function profileKey(form) {
  return [
    (form && form.gender) || '',
    (form && form.birthDate) || '',
    (form && form.heightCm) || '',
    (form && form.weightKg) || '',
    (form && form.activityLevel) || '',
    (form && form.goal) || ''
  ].join('|')
}

Page({
  data: {
    form: {
      gender: '',
      birthDate: '',
      age: '',
      heightCm: '',
      weightKg: '',
      activityLevel: '',
      goal: ''
    },
    birthLabel: '',
    activityHint: '',
    goalHint: '',
    startDate: '1920-01-01',
    endDate: util.formatDate(),
    metrics: {},
    targetRows: [],
    savedKey: '',
    booted: false
  },

  onLoad() {
    if (!util.ensureLogin()) return
    this.setData({ endDate: util.formatDate() })
    this.load()
  },

  onShow() {
    if (!this.data.booted) return
    this.setData({ endDate: util.formatDate() })
    this.load()
  },

  applyBody(body) {
    const birthDate = (body && body.birthDate) || ''
    const age = birthDate
      ? util.ageFromBirthDate(birthDate)
      : (body && body.age ? Number(body.age) : 0)
    const activityLevel = (body && body.activityLevel) || ''
    const goal = normalizeGoal(body && body.goal)
    const form = {
      gender: normalizeGender(body && body.gender),
      birthDate,
      age: age ? String(age) : '',
      heightCm: body && body.heightCm ? String(body.heightCm) : '',
      weightKg: body && body.weightKg ? String(body.weightKg) : '',
      activityLevel,
      goal
    }
    this.setData({
      form,
      birthLabel: birthDate ? util.formatDisplayDate(birthDate) : '',
      activityHint: ACTIVITY_HINTS[activityLevel] || '',
      goalHint: GOAL_HINTS[goal] || '',
      metrics: (body && body.metrics) || {},
      targetRows: targetRows((body && body.metrics) || {}),
      savedKey: profileKey(form),
      booted: true
    })
  },

  async load() {
    try {
      const body = await api.fetchBodyProfile()
      this.applyBody(body)
    } catch (e) {
      this.setData({ booted: true })
    }
  },

  onGender(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.v })
  },

  onActivity(e) {
    const activityLevel = e.currentTarget.dataset.v
    this.setData({
      'form.activityLevel': activityLevel,
      activityHint: ACTIVITY_HINTS[activityLevel] || ''
    })
  },

  onGoal(e) {
    const goal = e.currentTarget.dataset.v
    this.setData({
      'form.goal': goal,
      goalHint: GOAL_HINTS[goal] || ''
    })
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
    const { form, metrics, savedKey } = this.data
    const heightCm = Number(form.heightCm)
    const weightKg = Number(form.weightKg)
    if (!form.gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' })
      return
    }
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
    if (!form.activityLevel) {
      wx.showToast({ title: '请选择活动量', icon: 'none' })
      return
    }
    if (!form.goal) {
      wx.showToast({ title: '请选择目标', icon: 'none' })
      return
    }
    const needGen = profileKey(form) !== savedKey || !(metrics && metrics.suggestKcal)
    wx.showLoading({ title: needGen ? '生成营养建议' : '保存中' })
    try {
      const body = await api.saveBodyProfile({
        gender: form.gender,
        birthDate: form.birthDate,
        age,
        heightCm,
        weightKg,
        activityLevel: form.activityLevel,
        goal: form.goal
      })
      this.applyBody(body)
      wx.hideLoading()
      if (body && body.suggestFallback) {
        wx.showToast({ title: '已保存，摄入建议为估算值', icon: 'none', duration: 2500 })
      } else {
        wx.showToast({ title: '已保存', icon: 'success' })
      }
      setTimeout(() => {
        const stack = getCurrentPages()
        if (stack.length > 1) {
          wx.navigateBack({
            fail() {
              wx.switchTab({ url: '/pages/diet/diet' })
            }
          })
        } else {
          wx.switchTab({ url: '/pages/diet/diet' })
        }
      }, 400)
    } catch (e) {
      wx.hideLoading()
    }
  }
})
