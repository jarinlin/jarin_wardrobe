const { BASE_URL, USE_MOCK, USE_CLOUD } = require('./config')
const auth = require('./auth')
const api = require('./api')

const UPLOAD_LIMITS = {
  photo: { minBytes: 2 * 1024, maxBytes: 10 * 1024 * 1024, hint: '2KB–10MB' },
  avatar: { minBytes: 1 * 1024, maxBytes: 2 * 1024 * 1024, hint: '1KB–2MB' }
}
const COMPRESS_ABOVE = 5 * 1024 * 1024

function normalizePurpose(purpose) {
  return purpose === 'avatar' ? 'avatar' : 'photo'
}

function getFileSize(filePath) {
  return new Promise((resolve) => {
    wx.getFileInfo({
      filePath,
      success: (res) => resolve(Number(res.size) || 0),
      fail: () => resolve(0)
    })
  })
}

function assertUploadSize(size, purpose) {
  const limit = UPLOAD_LIMITS[normalizePurpose(purpose)]
  if (size > 0 && (size < limit.minBytes || size > limit.maxBytes)) {
    const title = `${purpose === 'avatar' ? '头像' : '图片'}大小需在 ${limit.hint}`
    wx.showToast({ title, icon: 'none' })
    return Promise.reject(new Error(title))
  }
  return Promise.resolve()
}

function compressOnce(src, quality, width) {
  return new Promise((resolve, reject) => {
    const opts = {
      src,
      quality,
      success: (r) => resolve(r.tempFilePath || src),
      fail: reject
    }
    if (width) opts.compressedWidth = width
    wx.compressImage(opts)
  })
}

/** 超过 5MB 时在小程序侧先压；云托管直传后端看不到原图，必须在这里做。 */
async function shrinkPhoto(filePath) {
  let path = filePath
  let size = await getFileSize(path)
  if (size < COMPRESS_ABOVE) {
    try {
      const light = await compressOnce(path, 80)
      const nextSize = await getFileSize(light)
      if (nextSize > 0 && nextSize <= size) {
        return light
      }
    } catch (e) {}
    return path
  }
  const steps = [
    { quality: 70, width: 2560 },
    { quality: 55, width: 1920 },
    { quality: 40, width: 1600 }
  ]
  for (const step of steps) {
    try {
      const next = await compressOnce(path, step.quality, step.width)
      const nextSize = await getFileSize(next)
      if (nextSize > 0 && nextSize < size) {
        path = next
        size = nextSize
      }
      if (size < COMPRESS_ABOVE) return path
    } catch (e) {}
  }
  return path
}

/**
 * 上传本地临时图片到后端，再由服务端写入当前对象存储
 * cloud 模式：callContainer 拿预签名 → 小程序直传 COS/R2（避开 100KB 限制）
 * @returns {Promise<string>} 可访问的图片 URL
 */
function uploadImage(filePath, purpose = 'photo') {
  purpose = normalizePurpose(purpose)
  if (USE_MOCK) {
    return Promise.resolve(filePath)
  }
  const token = auth.getToken()
  if (!token) {
    return Promise.reject(new Error('请先登录'))
  }

  const prepare = purpose === 'photo' ? shrinkPhoto(filePath) : Promise.resolve(filePath)
  return prepare.then((local) =>
    getFileSize(local).then((size) =>
      assertUploadSize(size, purpose).then(() => {
        if (USE_CLOUD) {
          return uploadImageViaCloud(local, purpose, size)
        }
        return uploadImageViaApi(local, token, purpose)
      })
    )
  )
}

function uploadImageViaApi(filePath, token, purpose) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/api/upload`,
      filePath,
      name: 'file',
      formData: { purpose },
      header: {
        Authorization: `Bearer ${token}`
      },
      success(res) {
        if (res.statusCode === 401) {
          auth.clear()
          wx.showToast({ title: '请重新登录', icon: 'none' })
          reject(res)
          return
        }
        let body = res.data
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body)
          } catch (e) {
            wx.showToast({ title: '上传响应异常', icon: 'none' })
            reject(e)
            return
          }
        }
        if (body && body.code === 0 && body.data && body.data.url) {
          resolve(body.data.url)
          return
        }
        wx.showToast({ title: (body && body.message) || '上传失败', icon: 'none' })
        reject(body || new Error('上传失败'))
      },
      fail(err) {
        console.error('[upload]', err)
        wx.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

function guessContentType(filePath) {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}

function rejectUnsupportedPath(filePath) {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.gif')) {
    return '图片仅支持 jpg/png/webp/bmp'
  }
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    return '暂不支持 HEIC，请用系统相册选择'
  }
  return ''
}

function uploadImageViaCloud(filePath, purpose, size) {
  const bad = rejectUnsupportedPath(filePath)
  if (bad) {
    wx.showToast({ title: bad, icon: 'none' })
    return Promise.reject(new Error(bad))
  }
  const contentType = guessContentType(filePath)
  const filename =
    contentType === 'image/png'
      ? 'image.png'
      : contentType === 'image/webp'
        ? 'image.webp'
        : contentType === 'image/bmp'
          ? 'image.bmp'
          : 'image.jpg'
  return api
    .request({
      url: '/api/upload/sign',
      method: 'POST',
      data: { filename, contentType, purpose, size: size || 0 }
    })
    .then((sign) => {
      if (!sign || !sign.putUrl || !sign.url) {
        return Promise.reject(new Error('上传签名无效'))
      }
      return new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath,
          success(fileRes) {
            wx.request({
              url: sign.putUrl,
              method: 'PUT',
              data: fileRes.data,
              header: {
                'Content-Type': sign.contentType || contentType
              },
              success(putRes) {
                if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
                  resolve(sign.url)
                  return
                }
                console.error('[upload.storage]', putRes.statusCode, putRes.data)
                wx.showToast({ title: '直传对象存储失败', icon: 'none' })
                reject(putRes)
              },
              fail(err) {
                console.error('[upload.storage]', err)
                wx.showToast({
                  title: '请配置存储合法域名',
                  icon: 'none'
                })
                reject(err)
              }
            })
          },
          fail(err) {
            console.error('[upload.read]', err)
            wx.showToast({ title: '读取图片失败', icon: 'none' })
            reject(err)
          }
        })
      })
    })
}

/** 选图并压缩后上传，返回对象存储 URL；选图/上传失败会 toast 并 reject */
function chooseAndUploadImage(count = 1, purpose = 'photo') {
  const util = require('./util')
  return util.chooseImage(count).then(async (paths) => {
    if (!paths.length) {
      wx.showToast({ title: '未选择图片', icon: 'none' })
      return Promise.reject(new Error('未选择图片'))
    }
    const urls = []
    for (const p of paths) {
      wx.showLoading({ title: '处理图片', mask: true })
      try {
        const url = await uploadImage(p, purpose)
        urls.push(url)
      } finally {
        wx.hideLoading()
      }
    }
    return urls
  })
}

module.exports = {
  uploadImage,
  chooseAndUploadImage
}
