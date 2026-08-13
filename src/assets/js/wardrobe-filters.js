/** 衣柜场合 / 季节关键词（从衣物 tags 聚合后展示为 chip） */
const OCCASION_SEASON_KEYS = [
  '通勤',
  '职场',
  '约会',
  '正式',
  '休闲',
  '运动',
  '居家',
  '派对',
  '旅行',
  '春',
  '夏',
  '秋',
  '冬',
  '春季',
  '夏季',
  '秋季',
  '冬季'
]

function pickOccasionSeasonChips(fromClothes = []) {
  const wanted = new Set(OCCASION_SEASON_KEYS)
  return (fromClothes || [])
    .filter((t) => t && t.name && wanted.has(String(t.name)))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 12)
}

module.exports = {
  OCCASION_SEASON_KEYS,
  pickOccasionSeasonChips
}
