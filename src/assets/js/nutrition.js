const FIELDS = [
  { key: 'calories', label: '热量', unit: 'kcal', role: 'target' },
  { key: 'proteinG', label: '蛋白质', unit: 'g', role: 'target' },
  { key: 'carbsG', label: '碳水', unit: 'g', role: 'target' },
  { key: 'fatG', label: '脂肪', unit: 'g', role: 'target' },
  { key: 'sugarG', label: '总糖', unit: 'g', role: 'reference' },
  { key: 'sodiumMg', label: '钠', unit: 'mg', role: 'upper' },
  { key: 'fiberG', label: '纤维', unit: 'g', role: 'lower' }
]

const MACRO_KEYS = ['proteinG', 'carbsG', 'fatG']
const ALL_KEYS = FIELDS.map((f) => f.key)

const ROLE_HINT = {
  target: '目标',
  reference: '参考',
  upper: '上限参考',
  lower: '最低参考'
}

function emptyNutrients() {
  return {
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    sugarG: '',
    sodiumMg: '',
    fiberG: ''
  }
}

function toNumber(v) {
  if (v === '' || v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function hasValue(v) {
  if (v === '' || v == null) return false
  const n = Number(v)
  return Number.isFinite(n)
}

function pickNutrients(src) {
  const out = emptyNutrients()
  if (!src) return out
  ALL_KEYS.forEach((key) => {
    if (hasValue(src[key])) out[key] = Number(src[key])
  })
  return out
}

function emptyItem() {
  return {
    foodName: '',
    portion: '',
    ...emptyNutrients(),
    sourceImage: '',
    expanded: false
  }
}

function itemFromApi(it, foodName, portion, calories) {
  if (typeof it === 'string') {
    return { ...emptyItem(), foodName: it }
  }
  const src = it || {}
  const row = {
    ...emptyItem(),
    foodName: src.foodName || foodName || '',
    portion: src.portion || portion || '',
    sourceImage: src.sourceImage || ''
  }
  ALL_KEYS.forEach((key) => {
    const raw = key === 'calories' ? (src.calories != null ? src.calories : calories) : src[key]
    row[key] = hasValue(raw) ? String(raw) : ''
  })
  return row
}

function normalizeItems(rawItems, foodName, portion, calories) {
  const list = Array.isArray(rawItems) ? rawItems : []
  const items = list
    .map((it) => itemFromApi(it, '', '', ''))
    .filter((it) => it.foodName || it.portion || ALL_KEYS.some((k) => it[k] !== ''))
  if (!items.length && (foodName || portion || calories)) {
    items.push(itemFromApi({}, foodName, portion, calories))
  }
  if (!items.length) items.push(emptyItem())
  return items
}

function itemToPayload(it) {
  const out = {
    foodName: (it.foodName || '').trim(),
    portion: (it.portion || '').trim(),
    calories: toNumber(it.calories)
  }
  MACRO_KEYS.concat(['sugarG', 'sodiumMg', 'fiberG']).forEach((key) => {
    if (hasValue(it[key])) out[key] = toNumber(it[key])
  })
  return out
}

function applyEstimate(item, result) {
  const next = { ...item }
  if (result && result.portion) next.portion = result.portion
  ALL_KEYS.forEach((key) => {
    if (hasValue(result && result[key])) next[key] = String(Math.round(Number(result[key]) * 10) / 10)
  })
  if (hasValue(result && result.calories)) next.calories = String(Math.round(Number(result.calories)))
  if (hasValue(result && result.sodiumMg)) next.sodiumMg = String(Math.round(Number(result.sodiumMg)))
  return next
}

function sumItems(items) {
  const totals = {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    sugarG: 0,
    sodiumMg: 0,
    fiberG: 0
  }
  const flags = {
    calories: false,
    proteinG: true,
    carbsG: true,
    fatG: true,
    sugarG: true,
    sodiumMg: true,
    fiberG: true
  }
  let count = 0
  ;(items || []).forEach((it) => {
    if (!it.foodName && !it.portion && !ALL_KEYS.some((k) => hasValue(it[k]))) return
    count += 1
    totals.calories += toNumber(it.calories)
    flags.calories = flags.calories || hasValue(it.calories)
    ;['proteinG', 'carbsG', 'fatG', 'sugarG', 'sodiumMg', 'fiberG'].forEach((key) => {
      totals[key] += toNumber(it[key])
      flags[key] = flags[key] && hasValue(it[key])
    })
  })
  if (!count) {
    Object.keys(flags).forEach((k) => {
      flags[k] = false
    })
  }
  totals.calories = Math.round(totals.calories)
  ;['proteinG', 'carbsG', 'fatG', 'sugarG', 'fiberG'].forEach((k) => {
    totals[k] = Math.round(totals[k] * 10) / 10
  })
  totals.sodiumMg = Math.round(totals.sodiumMg)
  return { totals, flags, complete: flags.proteinG && flags.carbsG && flags.fatG }
}

function formatNutrient(value, field, present) {
  if (present === false || !hasValue(value)) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (field === 'calories' || field === 'sodiumMg') return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

function buildProgress(targets, totals, flags) {
  const t = pickNutrients(targets)
  const c = pickNutrients(totals)
  return FIELDS.map((field) => {
    const target = toNumber(t[field.key])
    const present = flags ? flags[field.key] !== false : hasValue(c[field.key])
    const consumed = toNumber(c[field.key])
    const ratio = target > 0 && present ? Math.min(100, Math.round((consumed / target) * 100)) : 0
    let over = false
    if (present && target > 0) {
      if (field.role === 'upper') over = consumed > target
      else if (field.role === 'target') over = consumed > target * 1.1
      else over = false
    }
    const remain = present && target > 0 ? target - consumed : null
    return {
      ...field,
      roleHint: ROLE_HINT[field.role] || '',
      targetText: target ? formatNutrient(target, field.key, true) : '—',
      consumedText: formatNutrient(consumed, field.key, present),
      remainText: remain == null ? '—' : formatNutrient(Math.abs(remain), field.key, true),
      remainLabel: !present || !target ? '暂无' : remain < 0 && field.role !== 'lower' ? '已超' : field.role === 'lower' ? '还差' : '还余',
      ratioPct: ratio,
      over,
      present
    }
  })
}

function homeMacros(progress) {
  return progress.filter((p) => ['proteinG', 'carbsG', 'fatG'].includes(p.key))
}

module.exports = {
  FIELDS,
  ROLE_HINT,
  emptyItem,
  emptyNutrients,
  normalizeItems,
  itemToPayload,
  applyEstimate,
  sumItems,
  formatNutrient,
  buildProgress,
  homeMacros,
  toNumber,
  hasValue
}
