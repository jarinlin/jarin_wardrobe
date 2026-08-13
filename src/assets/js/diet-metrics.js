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
    content: '记饮食需要身高、体重，才能估算热量和建议摄入。',
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

function buildDayCard(metrics, todayKcal) {
  const suggestDay = Math.round(Number(metrics && metrics.suggestKcal) || 0)
  const today = Math.round(Number(todayKcal) || 0)
  if (!suggestDay) {
    return {
      suggestDay: 0,
      todayKcal: today,
      remainText: '—',
      remainLabel: '还可摄入',
      remainOver: false,
      ratioPct: 0,
      remainClass: '',
      barClass: 'week-bar-fill',
      sub: '完善档案后可看还能吃多少',
      tip: '点上方卡片填写身高体重'
    }
  }
  const remain = suggestDay - today
  const remainOver = remain < 0
  const remainAbs = Math.abs(remain)
  const ratioPct = Math.min(100, Math.round((today / suggestDay) * 100))
  let sub = '还可再吃约 ' + remainAbs + ' kcal'
  let tip = '建议日摄入 ' + suggestDay + ' kcal，已吃 ' + today
  if (today === 0) {
    sub = '今天还没记餐'
    tip = '建议今天大约 ' + suggestDay + ' kcal'
  } else if (remainOver) {
    sub = '已超过建议摄入'
    tip = '已超过建议约 ' + remainAbs + ' kcal'
  } else if (remain === 0) {
    sub = '已达到建议摄入'
    tip = '今日摄入刚好约 ' + suggestDay + ' kcal'
  }
  return {
    suggestDay,
    todayKcal: today,
    remainText: String(remainAbs),
    remainLabel: remainOver ? '已超摄入' : '还可摄入',
    remainOver,
    remainClass: remainOver ? 'over' : '',
    barClass: remainOver ? 'week-bar-fill over' : 'week-bar-fill',
    ratioPct,
    sub,
    tip
  }
}

module.exports = {
  buildDayCard,
  isBodyReady,
  promptBodyProfile,
  mealPlaceholderUrl
}
