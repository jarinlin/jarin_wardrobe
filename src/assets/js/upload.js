const { BASE_URL, USE_MOCK, USE_CLOUD } = require('./config')
const auth = require('./auth')
const api = require('./api')

/**
 * 上传本地临时图片到后端，再由服务端写入当前对象存储
 * cloud 模式：callContainer 拿预签名 → 小程序直传 COS/R2（避开 100KB 限制）
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

  if (USE_CLOUD) {
    return uploadImageViaCloud(filePath)
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

function guessContentType(filePath) {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function uploadImageViaCloud(filePath) {
  const contentType = guessContentType(filePath)
  const filename = contentType === 'image/png' ? 'image.png' : 'image.jpg'
  return api
    .request({
      url: '/api/upload/sign',
      method: 'POST',
      data: { filename, contentType }
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
function chooseAndUploadImage(count = 1) {
  const util = require('./util')
  return util.chooseImage(count).then(async (paths) => {
    if (!paths.length) {
      wx.showToast({ title: '未选择图片', icon: 'none' })
      return Promise.reject(new Error('未选择图片'))
    }
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
