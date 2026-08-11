const { BASE_URL, USE_MOCK } = require('./config')
const auth = require('./auth')

/**
 * 上传本地临时图片到后端，再由服务端写入腾讯云 COS
 * @returns {Promise<string>} 可访问的图片 URL
 */
function uploadImage(filePath) {
  if (USE_MOCK) {
    return Promise.resolve(filePath)
  }
  const token = auth.getToken()
  if (!token) {
    return Promise.reject(new Error('请先登录'))
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/api/upload`,
      filePath,
      name: 'file',
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

/** 选图并压缩后上传，返回 COS URL */
function chooseAndUploadImage(count = 1) {
  const util = require('./util')
  return util.chooseImage(count).then(async (paths) => {
    if (!paths.length) return []
    const urls = []
    for (const p of paths) {
      let local = p
      try {
        const compressed = await new Promise((resolve, reject) => {
          wx.compressImage({
            src: p,
            quality: 80,
            success: (r) => resolve(r.tempFilePath),
            fail: reject
          })
        })
        local = compressed || p
      } catch (e) {
        // 压缩失败则用原图
      }
      wx.showLoading({ title: '上传中', mask: true })
      try {
        const url = await uploadImage(local)
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
