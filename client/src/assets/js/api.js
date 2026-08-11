const { BASE_URL, USE_MOCK } = require('./config')
const auth = require('./auth')
const mock = require('./mock')

function request(options) {
  const { url, method = 'GET', data, header = {} } = options
  const token = auth.getToken()

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...header
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === 0) resolve(body.data)
            else {
              wx.showToast({ title: body.message || '请求失败', icon: 'none' })
              reject(body)
            }
          } else {
            resolve(body)
          }
        } else if (res.statusCode === 401) {
          auth.clear()
          wx.showToast({ title: '请重新登录', icon: 'none' })
          reject(res)
        } else {
          wx.showToast({ title: '网络异常', icon: 'none' })
          reject(res)
        }
      },
      fail(err) {
        wx.showToast({ title: '无法连接服务器', icon: 'none' })
        reject(err)
      }
    })
  })
}

/** ---------- 登录 ---------- */
function loginWithCode(code, profile = {}) {
  if (USE_MOCK) {
    const user = {
      id: 1,
      nickname: profile.nickName || 'Jarin',
      avatarUrl: profile.avatarUrl || '',
      openid: 'mock_openid'
    }
    const token = 'mock_token_' + Date.now()
    auth.setToken(token)
    auth.setUserInfo(user)
    return Promise.resolve({ token, user })
  }
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data: { code, ...profile }
  }).then((data) => {
    auth.setToken(data.token)
    auth.setUserInfo(data.user)
    return data
  })
}

/** ---------- 衣物 ---------- */
function fetchClothes(params = {}) {
  if (USE_MOCK) {
    let list = mock.getClothes()
    if (params.categoryId) {
      list = list.filter((c) => String(c.categoryId) === String(params.categoryId))
    }
    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(kw) ||
          (c.brand || '').toLowerCase().includes(kw) ||
          (c.color || '').toLowerCase().includes(kw)
      )
    }
    return Promise.resolve(list)
  }
  return request({ url: '/api/clothes', data: params })
}

function fetchClothingDetail(id) {
  if (USE_MOCK) {
    const item = mock.getClothes().find((c) => String(c.id) === String(id))
    return item ? Promise.resolve(item) : Promise.reject(new Error('not found'))
  }
  return request({ url: `/api/clothes/${id}` })
}

function createClothing(payload) {
  if (USE_MOCK) {
    const categories = mock.getCategories()
    const cat = categories.find((c) => String(c.id) === String(payload.categoryId))
    const item = {
      ...payload,
      id: mock.nextId('clothing'),
      categoryName: cat ? cat.name : '',
      wearCount: payload.wearCount || 0,
      tags: payload.tags || [],
      createdAt: new Date().toISOString()
    }
    const list = mock.getClothes()
    list.unshift(item)
    mock.saveClothes(list)
    return Promise.resolve(item)
  }
  return request({ url: '/api/clothes', method: 'POST', data: payload })
}

function updateClothing(id, payload) {
  if (USE_MOCK) {
    const list = mock.getClothes()
    const idx = list.findIndex((c) => String(c.id) === String(id))
    if (idx < 0) return Promise.reject(new Error('not found'))
    const categories = mock.getCategories()
    const cat = categories.find((c) => String(c.id) === String(payload.categoryId))
    list[idx] = {
      ...list[idx],
      ...payload,
      categoryName: cat ? cat.name : list[idx].categoryName
    }
    mock.saveClothes(list)
    return Promise.resolve(list[idx])
  }
  return request({ url: `/api/clothes/${id}`, method: 'PUT', data: payload })
}

function deleteClothing(id) {
  if (USE_MOCK) {
    mock.saveClothes(mock.getClothes().filter((c) => String(c.id) !== String(id)))
    return Promise.resolve(true)
  }
  return request({ url: `/api/clothes/${id}`, method: 'DELETE' })
}

/** ---------- 分类 ---------- */
function fetchCategories() {
  if (USE_MOCK) return Promise.resolve(mock.getCategories())
  return request({ url: '/api/categories' })
}

function createCategory(name) {
  if (USE_MOCK) {
    const list = mock.getCategories()
    const item = { id: mock.nextId('category'), name, sort: list.length + 1 }
    list.push(item)
    mock.saveCategories(list)
    return Promise.resolve(item)
  }
  return request({ url: '/api/categories', method: 'POST', data: { name } })
}

function updateCategory(id, name) {
  if (USE_MOCK) {
    const list = mock.getCategories()
    const idx = list.findIndex((c) => String(c.id) === String(id))
    if (idx < 0) return Promise.reject(new Error('not found'))
    list[idx].name = name
    mock.saveCategories(list)
    return Promise.resolve(list[idx])
  }
  return request({ url: `/api/categories/${id}`, method: 'PUT', data: { name } })
}

function deleteCategory(id) {
  if (USE_MOCK) {
    mock.saveCategories(mock.getCategories().filter((c) => String(c.id) !== String(id)))
    return Promise.resolve(true)
  }
  return request({ url: `/api/categories/${id}`, method: 'DELETE' })
}

/** ---------- 穿搭 ---------- */
function fetchOutfits() {
  if (USE_MOCK) {
    return Promise.resolve(
      mock.getOutfits().sort((a, b) => (a.date < b.date ? 1 : -1))
    )
  }
  return request({ url: '/api/outfits' })
}

function fetchOutfitDetail(id) {
  if (USE_MOCK) {
    const item = mock.getOutfits().find((o) => String(o.id) === String(id))
    return item ? Promise.resolve(item) : Promise.reject(new Error('not found'))
  }
  return request({ url: `/api/outfits/${id}` })
}

function fetchTodayOutfit(date) {
  if (USE_MOCK) {
    const item = mock.getOutfits().find((o) => o.date === date) || null
    return Promise.resolve(item)
  }
  return request({ url: '/api/outfits/today', data: { date } })
}

function createOutfit(payload) {
  if (USE_MOCK) {
    const list = wx.getStorageSync('mock_outfits') || []
    const exists = list.find((o) => o.date === payload.date)
    if (exists) {
      exists.note = payload.note || ''
      exists.imageUrl = payload.imageUrl || ''
      exists.clothingIds = payload.clothingIds || []
      mock.saveOutfits(list)
      // 增加衣物使用次数（简化：每次保存 +1，仅对新加的不严格处理）
      bumpWearCount(payload.clothingIds)
      return Promise.resolve(mock.getOutfits().find((o) => o.id === exists.id))
    }
    const item = {
      id: mock.nextId('outfit'),
      date: payload.date,
      note: payload.note || '',
      imageUrl: payload.imageUrl || '',
      wearCount: 1,
      clothingIds: payload.clothingIds || []
    }
    list.unshift(item)
    mock.saveOutfits(list)
    bumpWearCount(payload.clothingIds)
    return Promise.resolve(mock.getOutfits().find((o) => o.id === item.id))
  }
  return request({ url: '/api/outfits', method: 'POST', data: payload })
}

function bumpWearCount(ids = []) {
  const clothes = mock.getClothes()
  ids.forEach((id) => {
    const c = clothes.find((x) => String(x.id) === String(id))
    if (c) c.wearCount = (c.wearCount || 0) + 1
  })
  mock.saveClothes(clothes)
}

function deleteOutfit(id) {
  if (USE_MOCK) {
    const list = wx.getStorageSync('mock_outfits') || []
    mock.saveOutfits(list.filter((o) => String(o.id) !== String(id)))
    return Promise.resolve(true)
  }
  return request({ url: `/api/outfits/${id}`, method: 'DELETE' })
}

/** ---------- 标签 / 统计 ---------- */
function fetchTags() {
  if (USE_MOCK) return Promise.resolve(mock.getTags())
  return request({ url: '/api/tags' })
}

function fetchStats() {
  if (USE_MOCK) {
    const clothes = mock.getClothes()
    const total = clothes.length
    const value = clothes.reduce((s, c) => s + (Number(c.price) || 0), 0)
    const mostWorn = [...clothes].sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))[0]
    const leastWorn = [...clothes].sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0))[0]
    const recent = [...clothes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 3)
    return Promise.resolve({ total, value, mostWorn, leastWorn, recent })
  }
  return request({ url: '/api/stats' })
}

module.exports = {
  request,
  loginWithCode,
  fetchClothes,
  fetchClothingDetail,
  createClothing,
  updateClothing,
  deleteClothing,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchOutfits,
  fetchOutfitDetail,
  fetchTodayOutfit,
  createOutfit,
  deleteOutfit,
  fetchTags,
  fetchStats
}
