const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const auth = require('../../src/assets/js/auth')
const { USE_MOCK } = require('../../src/assets/js/config')

function isPlaceholderNick(name) {
  const n = (name || '').trim()
  return !n || n === '微信用户'
}

function toastError(err, fallback) {
  const raw = (err && (err.message || err.errMsg)) || fallback
  const title = String(raw || fallback).replace(/\s+/g, ' ').slice(0, 20)
  wx.showToast({ title: title || fallback, icon: 'none' })
}

function isMockOpenID(user) {
  return !!(user && String(user.openid || '').indexOf('mock_') === 0)
}

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    loading: false,
    needProfile: false,
    defaultAvatar: '/src/assets/icons/mine-active.png'
  },

  onLoad() {
    if (auth.isLoggedIn()) {
      this.finishLogin()
      return
    }
    this.ensureWxSession()
  },

  ensureWxSession() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          this.pendingCode = res.code || ''
          resolve(this.pendingCode)
        },
        fail: () => {
          this.pendingCode = ''
          resolve('')
        }
      })
    })
  },

  finishLogin() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onChooseAvatar(e) {
    const tempUrl = (e.detail && e.detail.avatarUrl) || ''
    if (!tempUrl) return
    this.setData({ avatarUrl: tempUrl })
  },

  onChooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        const path = (file && (file.tempFilePath || file.filePath)) || ''
        if (path) this.setData({ avatarUrl: path })
      }
    })
  },

  onNickname(e) {
    this.setData({ nickname: (e.detail && e.detail.value) || '' })
  },

  onSkipProfile() {
    if (!auth.isLoggedIn()) return
    this.finishLogin()
  },

  onPrimaryTap() {
    if (this.data.needProfile) {
      this.completeProfile()
    } else {
      this.wxLogin()
    }
  },

  /** 第一步：微信一键登录，由服务端判断是否新用户 */
  wxLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    wx.login({
      success: async (res) => {
        try {
          const code = res.code || this.pendingCode || ''
          if (!code && !USE_MOCK) {
            toastError(null, '微信登录失败，请重试')
            return
          }
          const data = await api.loginWithCode(code, {
            nickName: '',
            avatarUrl: ''
          })
          if (!USE_MOCK && isMockOpenID(data.user)) {
            auth.clear()
            toastError(null, '微信登录失败，请重试')
            return
          }
          const app = getApp()
          app.setUserInfo(data.user)

          if (data.needProfile) {
            this.ensureWxSession()
            this.setData({
              needProfile: true,
              nickname: '',
              avatarUrl: ''
            })
            return
          }

          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            this.finishLogin()
          }, 400)
        } catch (e) {
          toastError(e, '登录失败')
        } finally {
          this.setData({ loading: false })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
      }
    })
  },

  /** 第二步：新用户补昵称；头像可选，选不了也能进 */
  async completeProfile() {
    if (this.data.loading) return
    const nick = (this.data.nickname || '').trim()
    const formAvatar = this.data.avatarUrl || ''
    if (isPlaceholderNick(nick)) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      let avatarUrl = formAvatar
      const needUpload =
        !!formAvatar &&
        (formAvatar.indexOf('wxfile://') === 0 ||
          /^https?:\/\/tmp/i.test(formAvatar) ||
          formAvatar.indexOf('http') !== 0)
      if (needUpload && !USE_MOCK) {
        avatarUrl = await upload.uploadImage(formAvatar, 'avatar')
      } else if (/127\.0\.0\.1|localhost/i.test(formAvatar)) {
        avatarUrl = ''
      }
      const user = await api.updateProfile({
        nickName: nick,
        avatarUrl
      })
      getApp().setUserInfo({ ...user, profileReady: true })
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        this.finishLogin()
      }, 400)
    } catch (e) {
      toastError(e, '保存失败')
    } finally {
      this.setData({ loading: false })
    }
  }
})
