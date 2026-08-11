const DEFAULT_CATEGORIES = [
  { id: 1, name: '上衣', sort: 1 },
  { id: 2, name: '裤装', sort: 2 },
  { id: 3, name: '外套', sort: 3 },
  { id: 4, name: '鞋子', sort: 4 },
  { id: 5, name: '包', sort: 5 },
  { id: 6, name: '配饰', sort: 6 }
]

function seed() {
  if (!wx.getStorageSync('mock_seeded')) {
    wx.setStorageSync('mock_categories', DEFAULT_CATEGORIES)
    wx.setStorageSync('mock_clothes', [
      {
        id: 1,
        name: '白色T恤',
        categoryId: 1,
        categoryName: '上衣',
        brand: 'Uniqlo',
        color: '白色',
        size: 'M',
        buyDate: '2026-03-12',
        price: 99,
        wearCount: 12,
        remark: '通勤百搭',
        imageUrl: '',
        tags: ['通勤', '夏季'],
        createdAt: '2026-03-12T10:00:00.000Z'
      },
      {
        id: 2,
        name: '黑色长裤',
        categoryId: 2,
        categoryName: '裤装',
        brand: 'ZARA',
        color: '黑色',
        size: '30',
        buyDate: '2026-02-01',
        price: 299,
        wearCount: 8,
        remark: '',
        imageUrl: '',
        tags: ['通勤'],
        createdAt: '2026-02-01T10:00:00.000Z'
      },
      {
        id: 3,
        name: '运动鞋',
        categoryId: 4,
        categoryName: '鞋子',
        brand: 'Nike',
        color: '白绿',
        size: '42',
        buyDate: '2025-11-20',
        price: 699,
        wearCount: 20,
        remark: '日常走路',
        imageUrl: '',
        tags: ['运动'],
        createdAt: '2025-11-20T10:00:00.000Z'
      }
    ])
    wx.setStorageSync('mock_outfits', [
      {
        id: 1,
        date: '2026-08-11',
        note: '轻松上班',
        imageUrl: '',
        wearCount: 5,
        clothingIds: [1, 2, 3],
        clothes: []
      }
    ])
    wx.setStorageSync('mock_tags', ['通勤', '运动', '聚会', '夏季', '秋冬'])
    wx.setStorageSync('mock_id_seq', { clothing: 3, outfit: 1, category: 6 })
    wx.setStorageSync('mock_seeded', 1)
  }
}

function nextId(type) {
  const seq = wx.getStorageSync('mock_id_seq') || {}
  seq[type] = (seq[type] || 0) + 1
  wx.setStorageSync('mock_id_seq', seq)
  return seq[type]
}

function getClothes() {
  seed()
  return wx.getStorageSync('mock_clothes') || []
}

function saveClothes(list) {
  wx.setStorageSync('mock_clothes', list)
}

function getCategories() {
  seed()
  return wx.getStorageSync('mock_categories') || []
}

function saveCategories(list) {
  wx.setStorageSync('mock_categories', list)
}

function getOutfits() {
  seed()
  const outfits = wx.getStorageSync('mock_outfits') || []
  const clothes = getClothes()
  return outfits.map((o) => ({
    ...o,
    clothes: (o.clothingIds || [])
      .map((id) => clothes.find((c) => c.id === id))
      .filter(Boolean)
  }))
}

function saveOutfits(list) {
  wx.setStorageSync('mock_outfits', list)
}

function getTags() {
  seed()
  return wx.getStorageSync('mock_tags') || []
}

function saveTags(list) {
  wx.setStorageSync('mock_tags', list)
}

module.exports = {
  seed,
  nextId,
  getClothes,
  saveClothes,
  getCategories,
  saveCategories,
  getOutfits,
  saveOutfits,
  getTags,
  saveTags
}
