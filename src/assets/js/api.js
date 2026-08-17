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
  } else if (res.statusCode === 403) {
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
      openid: 'mock_openid',
      is_admin: false
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

function isAdminUser(user) {
  return !!(user && (user.is_admin === true || user.isAdmin === true))
}

function fetchMe() {
  if (USE_MOCK) {
    const user = { ...(auth.getUserInfo() || {}), is_admin: false }
    auth.setUserInfo(user)
    return Promise.resolve(user)
  }
  return request({ url: '/api/me' }).then((user) => {
    auth.setUserInfo(user)
    return user
  })
}

function fetchAdminReport() {
  if (USE_MOCK) {
    return Promise.reject({ statusCode: 403 })
  }
  return request({ url: '/api/admin/report' })
}

function updateProfile(profile = {}) {
  if (USE_MOCK) {
    const user = {
      ...(auth.getUserInfo() || {}),
      nickname: profile.nickName || (auth.getUserInfo() && auth.getUserInfo().nickname) || 'Jarin',
      avatarUrl: profile.avatarUrl || (auth.getUserInfo() && auth.getUserInfo().avatarUrl) || '',
      is_admin: false
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
    if (params.tagsStatus) {
      const ts = String(params.tagsStatus)
      if (ts === 'untagged' || ts === 'empty') {
        list = list.filter((c) => !c.tagsStatus)
      } else {
        list = list.filter((c) => c.tagsStatus === ts)
      }
    }
    if (params.idleDays) {
      return Promise.resolve(list)
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

function fetchTaggingStatus() {
  if (USE_MOCK) {
    return Promise.resolve({ total: 0, ready: 0, pending: 0, failed: 0, untagged: 0, items: [] })
  }
  return request({ url: '/api/clothes/tagging' })
}

function retagBatch(scope) {
  if (USE_MOCK) {
    return Promise.resolve({ queued: 0, scope: scope || 'failed' })
  }
  return request({ url: '/api/clothes/retag-batch', method: 'POST', data: { scope: scope || 'failed' } })
}

function exportBackup() {
  if (USE_MOCK) {
    return Promise.resolve({
      exportedAt: new Date().toISOString(),
      version: 1,
      categories: mock.getCategories(),
      clothes: mock.getClothes(),
      outfits: mock.getOutfits()
    })
  }
  return request({ url: '/api/export/backup' })
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
      mock.getOutfits().sort((a, b) => (a.date < b.date ? 1 : -1)).map((o) => {
        const post = mockOotdPosts().find(
          (p) => p.status === 'published' && String(p.outfitId) === String(o.id)
        )
        return {
          ...o,
          ootdPublished: !!post,
          ootdPostId: post ? post.id : 0
        }
      })
    )
  }
  return request({ url: '/api/outfits' })
}

function fetchOutfitDetail(id) {
  if (USE_MOCK) {
    const item = mock.getOutfits().find((o) => String(o.id) === String(id))
    if (!item) return Promise.reject(new Error('not found'))
    const post = mockOotdPosts().find(
      (p) => p.status === 'published' && String(p.outfitId) === String(id)
    )
    return Promise.resolve({
      ...item,
      ootdPublished: !!post,
      ootdPostId: post ? post.id : 0
    })
  }
  return request({ url: `/api/outfits/${id}` })
}

function fetchTodayOutfit(date) {
  if (USE_MOCK) {
    const item = mock.getOutfits().find((o) => o.date === date) || null
    return Promise.resolve(item ? withMockOotdFlag(item) : null)
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
      return Promise.resolve(withMockOotdFlag(mock.getOutfits().find((o) => o.id === exists.id)))
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
    return Promise.resolve(withMockOotdFlag(mock.getOutfits().find((o) => o.id === item.id)))
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
    const posts = wx.getStorageSync('mock_ootd_posts') || []
    wx.setStorageSync(
      'mock_ootd_posts',
      posts.map((p) =>
        String(p.outfitId) === String(id) ? { ...p, status: 'withdrawn', outfitId: null } : p
      )
    )
    return Promise.resolve(true)
  }
  return request({ url: `/api/outfits/${id}`, method: 'DELETE' })
}

function mockOotdPosts() {
  return wx.getStorageSync('mock_ootd_posts') || []
}

function withMockOotdFlag(item) {
  if (!item) return item
  const post = mockOotdPosts().find(
    (p) => p.status === 'published' && String(p.outfitId) === String(item.id)
  )
  return {
    ...item,
    ootdPublished: !!post,
    ootdPostId: post ? post.id : 0
  }
}

function saveMockOotdPosts(list) {
  wx.setStorageSync('mock_ootd_posts', list)
}

function mockAuthor() {
  const user = auth.getUserInfo() || {}
  return {
    nickname: user.nickname || '我',
    avatarUrl: user.avatarUrl || ''
  }
}

function mapMockOotd(p, uid) {
  const mine = String(p.userId) === String(uid)
  const out = {
    id: p.id,
    caption: p.showCaption ? p.caption || '' : '',
    imageUrl: p.showPhoto ? p.imageUrl || '' : '',
    itemNames: p.showItems ? p.itemNames || [] : [],
    likeCount: p.likeCount || 0,
    liked: (p.likedBy || []).some((id) => String(id) === String(uid)),
    status: p.status,
    createdAt: p.createdAt,
    mine,
    author: p.author || mockAuthor()
  }
  if (mine) {
    out.showPhoto = !!p.showPhoto
    out.showCaption = !!p.showCaption
    out.showItems = !!p.showItems
    out.captionDraft = p.caption || ''
    out.outfitId = p.outfitId
  }
  return out
}

function fetchOotdFeed(params = {}) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const sort = params.sort === 'new' ? 'new' : 'hot'
    const range = params.range === 'all' ? 'all' : 'week'
    let list = mockOotdPosts().filter((p) => p.status === 'published')
    if (sort === 'hot' && range === 'week') {
      const start = Date.now() - 7 * 24 * 3600 * 1000
      list = list.filter((p) => new Date(p.createdAt).getTime() >= start)
    }
    list.sort((a, b) => {
      if (sort === 'new') return (b.createdAt || '').localeCompare(a.createdAt || '')
      const d = (b.likeCount || 0) - (a.likeCount || 0)
      if (d) return d
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })
    return Promise.resolve(list.map((p, i) => ({ ...mapMockOotd(p, uid), rank: i + 1 })))
  }
  return request({ url: '/api/ootd/feed', data: params })
}

function fetchOotdPost(id) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const p = mockOotdPosts().find((x) => String(x.id) === String(id))
    if (!p || (p.status !== 'published' && String(p.userId) !== String(uid))) {
      return Promise.reject(new Error('not found'))
    }
    return Promise.resolve(mapMockOotd(p, uid))
  }
  return request({ url: `/api/ootd/posts/${id}` })
}

function fetchOotdMine(outfitId) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const p = mockOotdPosts().find(
      (x) => String(x.userId) === String(uid) && String(x.outfitId) === String(outfitId)
    )
    if (!p) {
      return Promise.resolve({ published: false, postId: 0, status: '', post: null })
    }
    return Promise.resolve({
      published: p.status === 'published',
      postId: p.id,
      status: p.status,
      post: mapMockOotd(p, uid)
    })
  }
  return request({ url: '/api/ootd/mine', data: { outfitId } })
}

function createOotdPost(payload) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const outfit = (mock.getOutfits() || []).find((o) => String(o.id) === String(payload.outfitId))
    if (!outfit) return Promise.reject(new Error('not found'))
    const list = mockOotdPosts()
    const existing = list.find(
      (p) => String(p.userId) === String(uid) && String(p.outfitId) === String(payload.outfitId)
    )
    const clothes = mock.getClothes() || []
    const ids = outfit.clothingIds || []
    const itemNames = ids
      .map((id) => {
        const c = clothes.find((x) => String(x.id) === String(id))
        return (c && c.name) || ''
      })
      .filter(Boolean)
    const row = {
      id: existing ? existing.id : Date.now(),
      userId: uid,
      outfitId: payload.outfitId,
      showPhoto: !!payload.showPhoto,
      showCaption: !!payload.showCaption,
      showItems: !!payload.showItems,
      caption: payload.caption || '',
      imageUrl: payload.showPhoto ? outfit.imageUrl || '' : '',
      itemNames: payload.showItems ? itemNames : [],
      likeCount: existing ? existing.likeCount || 0 : 0,
      likedBy: existing ? existing.likedBy || [] : [],
      status: 'published',
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      author: mockAuthor()
    }
    const next = existing
      ? list.map((p) => (p.id === existing.id ? row : p))
      : [row, ...list]
    saveMockOotdPosts(next)
    return Promise.resolve(mapMockOotd(row, uid))
  }
  return request({ url: '/api/ootd/posts', method: 'POST', data: payload })
}

function updateOotdPost(id, payload) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const list = mockOotdPosts()
    const idx = list.findIndex((p) => String(p.id) === String(id) && String(p.userId) === String(uid))
    if (idx < 0) return Promise.reject(new Error('not found'))
    const cur = { ...list[idx], ...payload }
    if (payload.status === 'withdrawn') cur.status = 'withdrawn'
    list[idx] = cur
    saveMockOotdPosts(list)
    return Promise.resolve(mapMockOotd(cur, uid))
  }
  return request({ url: `/api/ootd/posts/${id}`, method: 'PUT', data: payload })
}

function likeOotdPost(id) {
  if (USE_MOCK) {
    const user = auth.getUserInfo() || {}
    const uid = user.id || 1
    const list = mockOotdPosts()
    const idx = list.findIndex((p) => String(p.id) === String(id))
    if (idx < 0) return Promise.reject(new Error('not found'))
    const p = list[idx]
    const likedBy = p.likedBy || []
    const has = likedBy.some((x) => String(x) === String(uid))
    p.likedBy = has ? likedBy.filter((x) => String(x) !== String(uid)) : likedBy.concat(uid)
    p.likeCount = p.likedBy.length
    list[idx] = p
    saveMockOotdPosts(list)
    return Promise.resolve({ liked: !has, likeCount: p.likeCount })
  }
  return request({ url: `/api/ootd/posts/${id}/like`, method: 'POST' })
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

function suggestOutfit(lat, lng, opts) {
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
  const q = []
  const latN = Number(lat)
  const lngN = Number(lng)
  if (Number.isFinite(latN) && Number.isFinite(lngN)) {
    q.push('lat=' + encodeURIComponent(String(latN)))
    q.push('lng=' + encodeURIComponent(String(lngN)))
  }
  if (opts && opts.refresh) q.push('refresh=1')
  if (opts && opts.fallback) q.push('fallback=1')
  if (opts && opts.exclude && opts.exclude.length) {
    q.push('exclude=' + encodeURIComponent(opts.exclude.filter(Boolean).join(',')))
  }
  const qs = q.length ? '?' + q.join('&') : ''
  // callContainer 的 GET data 不一定进 query，坐标必须写在 path 上
  return request({ url: '/api/suggest/outfit' + qs, method: 'GET' })
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
  const imageUrls = Array.isArray(imageUrl) ? imageUrl.filter(Boolean) : [imageUrl].filter(Boolean)
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
    data: { imageUrl: imageUrls[0] || '', imageUrls, mealType }
  })
}

function suggestFoodAdvice(items, mealType) {
  if (USE_MOCK) {
    return Promise.resolve({ advice: '这餐搭配还行，蔬菜可以再多一点。' })
  }
  return request({
    url: '/api/ai/food/advice',
    method: 'POST',
    data: { items: items || [], mealType }
  })
}

function estimateFoodCalories(foodName, portion) {
  if (USE_MOCK) {
    return Promise.resolve({
      calories: 180,
      portion: portion || '约150g'
    })
  }
  return request({
    url: '/api/ai/food/estimate',
    method: 'POST',
    data: { foodName, portion: portion || '' }
  })
}

function fetchBodyProfile() {
  if (USE_MOCK) {
    return Promise.resolve({
      gender: 'female',
      birthDate: '1998-03-12',
      age: 28,
      heightCm: 165,
      weightKg: 52,
      activityLevel: 'light',
      goal: 'maintain',
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
    return Promise.resolve({ list: [], totalCalories: 0, aiAdvice: '' })
  }
  const q = []
  if (params.date) q.push('date=' + encodeURIComponent(params.date))
  const qs = q.length ? '?' + q.join('&') : ''
  return request({ url: '/api/diet' + qs })
}

function fetchDietWeekSummary() {
  if (USE_MOCK) {
    return Promise.resolve({
      from: '',
      to: '',
      days: 7,
      daysWithLog: 0,
      totalCalories: 0,
      avgDaily: 0,
      suggestKcal: 0,
      overDays: 0
    })
  }
  return request({ url: '/api/diet/week' })
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
  fetchMe,
  fetchAdminReport,
  isAdminUser,
  updateProfile,
  analyzeClothing,
  analyzeFood,
  suggestFoodAdvice,
  estimateFoodCalories,
  fetchBodyProfile,
  saveBodyProfile,
  fetchDietLogs,
  fetchDietWeekSummary,
  fetchDietDetail,
  createDietLog,
  updateDietLog,
  deleteDietLog,
  fetchClothes,
  fetchClothingDetail,
  createClothing,
  updateClothing,
  retagClothing,
  fetchTaggingStatus,
  retagBatch,
  exportBackup,
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
  fetchOotdFeed,
  fetchOotdPost,
  fetchOotdMine,
  createOotdPost,
  updateOotdPost,
  likeOotdPost,
  fetchTags,
  createTag,
  deleteTag,
  fetchWeather,
  suggestOutfit,
  fetchStats
}
