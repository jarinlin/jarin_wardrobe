const test = require('node:test')
const assert = require('node:assert/strict')
const nutrition = require('../src/assets/js/nutrition')

test('old items without macros stay incomplete', () => {
  const items = nutrition.normalizeItems([{ foodName: '米饭', portion: '1碗', calories: 200 }])
  const { totals, flags, complete } = nutrition.sumItems(items)
  assert.equal(totals.calories, 200)
  assert.equal(complete, false)
  assert.equal(flags.proteinG, false)
})

test('full items sum macros', () => {
  const items = nutrition.normalizeItems([
    { foodName: '鸡胸', calories: 248, proteinG: 46, carbsG: 0, fatG: 5, sugarG: 0, sodiumMg: 70, fiberG: 0 }
  ])
  const { totals, complete } = nutrition.sumItems(items)
  assert.equal(complete, true)
  assert.equal(totals.proteinG, 46)
})

test('sugar overage is not marked for reference role', () => {
  const progress = nutrition.buildProgress(
    { calories: 1800, proteinG: 80, carbsG: 200, fatG: 50, sugarG: 45, sodiumMg: 2000, fiberG: 25 },
    { calories: 900, proteinG: 40, carbsG: 100, fatG: 25, sugarG: 80, sodiumMg: 900, fiberG: 10 },
    { calories: true, proteinG: true, carbsG: true, fatG: true, sugarG: true, sodiumMg: true, fiberG: true }
  )
  const sugar = progress.find((p) => p.key === 'sugarG')
  assert.equal(sugar.role, 'reference')
  assert.equal(sugar.over, false)
})

test('payload omits missing macros', () => {
  const payload = nutrition.itemToPayload({ foodName: '汤', portion: '1碗', calories: '80' })
  assert.equal(payload.calories, 80)
  assert.equal(payload.proteinG, undefined)
})
