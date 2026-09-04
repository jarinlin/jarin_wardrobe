const nutrition = require('./nutrition')

const MEAL_PLACEHOLDERS = {
  breakfast: '/src/assets/images/diet/diet-breakfast.png',
  lunch: '/src/assets/images/diet/diet-lunch.png',
  dinner: '/src/assets/images/diet/diet-dinner.png',
  other: '/src/assets/images/diet/diet-other.png'
}

function mealPlaceholderUrl(mealType) {
  return MEAL_PLACEHOLDERS[mealType] || MEAL_PLACEHOLDERS.other
}

function isBodyReady(body) {
  const h = Number(body && body.heightCm)
  const w = Number(body && body.weightKg)
  return Number.isFinite(h) && h > 0 && Number.isFinite(w) && w > 0
}

function promptBodyProfile(opts) {
  const redirect = !!(opts && opts.redirect)
  wx.showModal({
    title: '先完善身体档案',
    content: '记饮食需要身高、体重，才能估算热量和每日营养建议。',
    confirmText: '去填写',
    confirmColor: '#B54A3A',
    showCancel: !(opts && opts.force),
    success(res) {
      if (!res.confirm && !(opts && opts.force)) return
      const url = '/pages/body-profile/body-profile'
      if (redirect) wx.redirectTo({ url })
      else wx.navigateTo({ url })
    }
  })
}

function dailyTargetsOf(metrics) {
  const t = (metrics && metrics.dailyTargets) || {}
  if (t.calories || t.proteinG) return t
  return { calories: metrics && metrics.suggestKcal }
}

function totalsOf(data) {
  if (data && data.totalNutrition) return data.totalNutrition
  return { calories: data && data.totalCalories }
}

function flagsOf(data) {
  const n = data && data.totalNutrition
  if (n && n.flags) return n.flags
  return { calories: true, proteinG: false, carbsG: false, fatG: false, sugarG: false, sodiumMg: false, fiberG: false }
}

function buildDayCard(metrics, dietData, aiAdvice) {
  const targets = dailyTargetsOf(metrics)
  const totals = totalsOf(dietData)
  const flags = flagsOf(dietData)
  const progress = nutrition.buildProgress(targets, totals, flags)
  const kcal = progress[0]
  const advice = String(aiAdvice || '').trim().replace(/^建议[：:]\s*/, '')
  const incomplete = flags.proteinG === false || (dietData && dietData.totalNutrition && dietData.totalNutrition.complete === 'partial')
  const suggestDay = Math.round(Number(targets.calories) || Number(metrics && metrics.suggestKcal) || 0)
  const today = Math.round(Number(totals.calories) || 0)
  let sub = '对照建议看还能吃多少'
  let tip = ''
  if (!suggestDay) {
    sub = '完善档案后可看还能吃多少'
    tip = '点上方卡片填写身高体重'
  } else if (today === 0) {
    sub = '今天还没记餐'
    tip = '建议今天大约 ' + suggestDay + ' kcal'
  } else if (kcal.over) {
    sub = '热量已超过建议'
    tip = '已超过建议约 ' + kcal.remainText + ' kcal'
  } else {
    sub = '热量还可再吃约 ' + kcal.remainText + ' kcal'
    tip = '建议日摄入 ' + suggestDay + ' kcal，已吃 ' + today
  }
  return {
    suggestDay,
    todayKcal: today,
    remainText: kcal.remainText,
    remainLabel: kcal.over ? '已超摄入' : '还可摄入',
    remainOver: !!kcal.over,
    ratioPct: kcal.ratioPct,
    remainClass: kcal.over ? 'over' : '',
    barClass: kcal.over ? 'week-bar-fill over' : 'week-bar-fill',
    sub,
    tip,
    aiAdvice: advice,
    incomplete,
    incompleteTip: incomplete ? '部分餐次只有热量，蛋白质等指标暂不参与判断' : '',
    progress,
    homeMacros: nutrition.homeMacros(progress)
  }
}

function scheduleAdviceRetry(page, hasTodayLogs, aiAdvice) {
  if (!page || page._dietAdviceRetried) return
  if (!hasTodayLogs) return
  if (String(aiAdvice || '').trim()) return
  page._dietAdviceRetried = true
  setTimeout(() => {
    if (typeof page.refreshDietAdvice === 'function') page.refreshDietAdvice()
    else if (typeof page.refresh === 'function') page.refresh()
  }, 1400)
}

function buildWeekLine(week) {
  if (!week || !Number(week.daysWithLog)) return ''
  const avg = Math.round(Number(week.avgDaily) || 0)
  const days = Number(week.daysWithLog) || 0
  const over = Number(week.overDays) || 0
  let s = '近7天均 ' + avg + ' 大卡 · 记了 ' + days + ' 天'
  if (Number(week.suggestKcal) > 0) s += ' · 热量超建议 ' + over + ' 天'
  const avgN = week.avgNutrition || {}
  if (Number(avgN.proteinG) > 0) s += ' · 蛋白均 ' + Math.round(avgN.proteinG) + 'g'
  return s
}

function targetRows(metrics) {
  return nutrition.buildProgress(dailyTargetsOf(metrics), dailyTargetsOf(metrics), {
    calories: true, proteinG: true, carbsG: true, fatG: true, sugarG: true, sodiumMg: true, fiberG: true
  }).filter((row) => row.key !== 'calories').map((row) => ({
    key: row.key,
    label: row.label,
    unit: row.unit,
    roleHint: row.roleHint,
    value: row.targetText
  }))
}

module.exports = {
  buildDayCard,
  isBodyReady,
  promptBodyProfile,
  mealPlaceholderUrl,
  scheduleAdviceRetry,
  buildWeekLine,
  targetRows,
  dailyTargetsOf
}
