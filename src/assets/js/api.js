const { BASE_URL, USE_MOCK, USE_CLOUD, CLOUD_ENV, CLOUD_SERVICE } = require('./config')
const auth = require('./auth')
const mock = require('./mock')

function handleResponse(res, resolve, reject) {
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
}

function request(options) {
  const { url, method = 'GET', data, header = {} } = options
  const token = auth.getToken()
  const commonHeader = {
    'content-type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    ...header
  }

  // 微信云托管：免域名备案，走 callContainer
  if (USE_CLOUD) {
    return new Promise((resolve, reject) => {
      if (!CLOUD_ENV || !CLOUD_SERVICE) {
        wx.showToast({ title: '请配置云托管环境', icon: 'none' })
        reject(new Error('CLOUD_ENV / CLOUD_SERVICE 未配置'))
        return
      }
      wx.cloud.callContainer({
        config: { env: CLOUD_ENV },
        path: url,
        method,
        data,
        header: {
          'X-WX-SERVICE': CLOUD_SERVICE,
          ...commonHeader
        },
        success(res) {
          handleResponse(res, resolve, reject)
        },
        fail(err) {
          console.error('[cloud.callContainer]', err)
          wx.showToast({ title: '云托管调用失败', icon: 'none' })
          reject(err)
        }
      })
    })
  }

  // 本地 / 自建服务器
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: commonHeader,
      success(res) {
        handleResponse(res, resolve, reject)
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
    const nick = (profile.nickName || '').trim()
    const avatar = (profile.avatarUrl || '').trim()
    const needProfile = !nick || nick === '微信用户' || !avatar
    const user = {
      id: 1,
      nickname: nick || '微信用户',
      avatarUrl: avatar,
      openid: 'mock_openid'
    }
    const token = 'mock_token_' + Date.now()
    auth.setToken(token)
    auth.setUserInfo(user)
    return Promise.resolve({ token, user, needProfile })
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

function updateProfile(profile = {}) {
  if (USE_MOCK) {
    const user = {
      ...(auth.getUserInfo() || {}),
      nickname: profile.nickName || (auth.getUserInfo() && auth.getUserInfo().nickname) || 'Jarin',
      avatarUrl: profile.avatarUrl || (auth.getUserInfo() && auth.getUserInfo().avatarUrl) || ''
    }
    auth.setUserInfo(user)
    return Promise.resolve(user)
  }
  return request({
    url: '/api/auth/profile',
    method: 'PUT',
    data: profile
  }).then((user) => {
    auth.setUserInfo(user)
    return user
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
    if (params.tag) {
      const tag = String(params.tag)
      list = list.filter((c) => (c.tags || []).includes(tag))
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

function retagClothing(id) {
  if (USE_MOCK) {
    return Promise.resolve({ id, tagsStatus: 'pending' })
  }
  return request({ url: `/api/clothes/${id}/retag`, method: 'POST' })
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
  if (USE_MOCK) {
    const counts = {}
    mock.getClothes().forEach((c) => {
      ;(c.tags || []).forEach((t) => {
        if (!t) return
        counts[t] = (counts[t] || 0) + 1
      })
    })
    const fromClothes = Object.keys(counts)
      .map((name) => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count)
    const list = (mock.getTags() || []).map((name, i) => ({ id: i + 1, name }))
    return Promise.resolve({ fromClothes, list })
  }
  return request({ url: '/api/tags' })
}

function createTag(name) {
  if (USE_MOCK) {
    const list = mock.getTags()
    if (!list.includes(name)) {
      list.push(name)
      mock.saveTags(list)
    }
    return Promise.resolve({ id: Date.now(), name })
  }
  return request({ url: '/api/tags', method: 'POST', data: { name } })
}

function deleteTag(id) {
  if (USE_MOCK) return Promise.resolve(true)
  return request({ url: `/api/tags/${id}`, method: 'DELETE' })
}

function fetchWeather(lat, lng) {
  if (USE_MOCK) {
    return Promise.resolve({
      city: '示例市',
      weather: '晴',
      temperature: '24',
      tempC: 24
    })
  }
  const data = {}
  if (lat != null && lng != null) {
    data.lat = lat
    data.lng = lng
  }
  return request({ url: '/api/weather', data })
}

function suggestOutfit(lat, lng) {
  if (USE_MOCK) {
    const clothes = mock.getClothes().slice(0, 4).map((c) => ({
      id: c.id,
      name: c.name,
      categoryId: c.categoryId,
      categoryName: c.categoryName || '',
      color: c.color,
      imageUrl: c.imageUrl,
      tags: c.tags || [],
      score: 10
    }))
    return Promise.resolve({
      items: clothes,
      reason: 'Mock 模式示例推荐',
      tips: '配置 local 后端与 AMAP_KEY 可拉取真实天气',
      seasonHint: '适中',
      weatherNote: '',
      weather: { city: '示例市', weather: '晴', temperature: '24', tempC: 24 }
    })
  }
  const data = {}
  if (lat != null && lng != null) {
    data.lat = lat
    data.lng = lng
  }
  return request({ url: '/api/suggest/outfit', data })
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

/** ---------- AI ---------- */
function analyzeClothing(imageUrl) {
  if (USE_MOCK) {
    return Promise.resolve({
      name: '示例白色T恤',
      categoryId: 1,
      categoryName: '上衣',
      brand: '',
      color: '白色',
      size: 'M',
      price: 99,
      priceEstimated: true,
      priceNote: '估算（Mock）',
      confidence: {},
      rawTags: []
    })
  }
  return request({
    url: '/api/ai/clothing/analyze',
    method: 'POST',
    data: { imageUrl }
  })
}

function analyzeFood(imageUrl, mealType) {
  if (USE_MOCK) {
    return Promise.resolve({
      foodName: '示例米饭套餐',
      portion: '约400g',
      calories: 620,
      advice: '分量适中，可搭配蔬菜。',
      items: ['米饭', '青菜'],
      confidence: 0.8
    })
  }
  return request({
    url: '/api/ai/food/analyze',
    method: 'POST',
    data: { imageUrl, mealType }
  })
}

function fetchBodyProfile() {
  if (USE_MOCK) {
    return Promise.resolve({
      gender: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 52,
      metrics: { bmi: 19.1, bmiLevel: '正常', bodyFatPct: 24, idealWeightKg: 60, bmr: 1300, suggestKcal: 1800 }
    })
  }
  return request({ url: '/api/profile/body' })
}

function saveBodyProfile(payload) {
  if (USE_MOCK) {
    return fetchBodyProfile()
  }
  return request({ url: '/api/profile/body', method: 'PUT', data: payload })
}

function fetchDietLogs(params = {}) {
  if (USE_MOCK) {
    return Promise.resolve({ list: [], totalCalories: 0 })
  }
  const q = []
  if (params.date) q.push('date=' + encodeURIComponent(params.date))
  const qs = q.length ? '?' + q.join('&') : ''
  return request({ url: '/api/diet' + qs })
}

function fetchDietDetail(id) {
  return request({ url: `/api/diet/${id}` })
}

function createDietLog(payload) {
  if (USE_MOCK) return Promise.resolve({ id: Date.now(), ...payload })
  return request({ url: '/api/diet', method: 'POST', data: payload })
}

function updateDietLog(id, payload) {
  return request({ url: `/api/diet/${id}`, method: 'PUT', data: payload })
}

function deleteDietLog(id) {
  if (USE_MOCK) return Promise.resolve(true)
  return request({ url: `/api/diet/${id}`, method: 'DELETE' })
}

module.exports = {
  request,
  loginWithCode,
  updateProfile,
  analyzeClothing,
  analyzeFood,
  fetchBodyProfile,
  saveBodyProfile,
  fetchDietLogs,
  fetchDietDetail,
  createDietLog,
  updateDietLog,
  deleteDietLog,
  fetchClothes,
  fetchClothingDetail,
  createClothing,
  updateClothing,
  retagClothing,
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
  createTag,
  deleteTag,
  fetchWeather,
  suggestOutfit,
  fetchStats
}
