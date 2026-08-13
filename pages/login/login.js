const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const auth = require('../../src/assets/js/auth')
const { USE_MOCK } = require('../../src/assets/js/config')

function isPlaceholderNick(name) {
  const n = (name || '').trim()
  return !n || n === '微信用户'
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
    }
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

  onNickname(e) {
    this.setData({ nickname: (e.detail && e.detail.value) || '' })
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
          const data = await api.loginWithCode(res.code || 'mock_code', {
            nickName: '',
            avatarUrl: ''
          })
          const app = getApp()
          app.setUserInfo(data.user)

          if (data.needProfile) {
            // 新用户：停留本页补头像/昵称
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
          wx.showToast({ title: '登录失败', icon: 'none' })
        } finally {
          this.setData({ loading: false })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: 'wx.login 失败', icon: 'none' })
      }
    })
  },

  /** 第二步：新用户补齐头像昵称并写入服务端 */
  async completeProfile() {
    if (this.data.loading) return
    const nick = (this.data.nickname || '').trim()
    const formAvatar = this.data.avatarUrl || ''
    if (!formAvatar) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    if (isPlaceholderNick(nick)) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      let avatarUrl = formAvatar
      const needUpload =
        formAvatar.indexOf('wxfile://') === 0 ||
        /^https?:\/\/tmp/i.test(formAvatar) ||
        (formAvatar.indexOf('http') !== 0)
      if (needUpload && !USE_MOCK) {
        avatarUrl = await upload.uploadImage(formAvatar)
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
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
