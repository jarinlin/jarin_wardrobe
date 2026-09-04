const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')
const { USE_MOCK } = require('../../src/assets/js/config')

function isPlaceholderNick(name) {
  const n = (name || '').trim()
  return !n || n === '微信用户'
}

Page({
  data: {
    about: '今天穿什么、吃什么，打开就能记。衣柜不再是黑洞，天气会帮你搭配，拍张餐也能估热量，好看的还可以丢上广场。界面字体使用小米 MiSans。',
    exporting: false,
    nickname: '',
    avatarUrl: '',
    defaultAvatar: '/src/assets/icons/mine-active.png',
    savingProfile: false,
    loggedIn: false,
    isAdmin: false
  },

  onShow() {
    const user = auth.getUserInfo() || {}
    const loggedIn = auth.isLoggedIn()
    this.setData({
      loggedIn,
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      isAdmin: false
    })
    if (loggedIn) this.refreshAdmin()
  },

  async refreshAdmin() {
    try {
      const me = await api.fetchMe()
      this.setData({
        nickname: me.nickname || this.data.nickname,
        avatarUrl: me.avatarUrl || this.data.avatarUrl,
        isAdmin: api.isAdminUser(me)
      })
      try {
        getApp().setUserInfo(me)
      } catch (e) {}
    } catch (e) {
      this.setData({ isAdmin: false })
    }
  },

  onAdminReport() {
    wx.navigateTo({ url: '/pages/admin-report/admin-report' })
  },

  onChooseAvatar(e) {
    const tempUrl = (e.detail && e.detail.avatarUrl) || ''
    if (!tempUrl) return
    this.setData({ avatarUrl: tempUrl })
  },

  onNickname(e) {
    this.setData({ nickname: (e.detail && e.detail.value) || '' })
  },

  async onSaveProfile() {
    if (!util.ensureLogin()) return
    if (this.data.savingProfile) return
    const nick = (this.data.nickname || '').trim()
    const formAvatar = this.data.avatarUrl || ''
    if (isPlaceholderNick(nick)) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    if (!formAvatar) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true })
    wx.showLoading({ title: '保存中', mask: true })
    try {
      let avatarUrl = formAvatar
      const needUpload =
        formAvatar.indexOf('wxfile://') === 0 ||
        /^https?:\/\/tmp/i.test(formAvatar) ||
        (formAvatar.indexOf('http') !== 0)
      if (needUpload && !USE_MOCK) {
        avatarUrl = await upload.uploadImage(formAvatar, 'avatar')
      } else if (/127\.0\.0\.1|localhost/i.test(formAvatar)) {
        avatarUrl = ''
      }
      const user = await api.updateProfile({
        nickName: nick,
        avatarUrl
      })
      try {
        getApp().setUserInfo({ ...user, profileReady: true })
      } catch (e) {
        auth.setUserInfo(user)
      }
      this.setData({
        nickname: user.nickname || nick,
        avatarUrl: user.avatarUrl || avatarUrl
      })
      wx.showToast({ title: '资料已更新', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ savingProfile: false })
    }
  },

  onClearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除筛选条件、部分本地临时数据；登录态默认保留。确定继续？',
      confirmColor: '#E85D75',
      success: (res) => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync('wardrobe_filter_tag')
          wx.removeStorageSync('wardrobe_filter_status')
          wx.removeStorageSync('suggest_outfit_ids')
          wx.removeStorageSync('suggest_outfit_note')
          wx.removeStorageSync('last_fuzzy_location')
          wx.removeStorageSync('mock_clothes')
          wx.removeStorageSync('mock_outfits')
          wx.removeStorageSync('mock_categories')
          wx.removeStorageSync('mock_tags')
          wx.removeStorageSync('mock_ootd_posts')
          wx.removeStorageSync('mock_id_seq')
          wx.removeStorageSync('mock_seeded')
        } catch (e) {}
        wx.showToast({ title: '已清理', icon: 'success' })
      }
    })
  },

  async onExport() {
    if (!util.ensureLogin()) return
    if (this.data.exporting) return
    this.setData({ exporting: true })
    wx.showLoading({ title: '导出中', mask: true })
    try {
      const data = await api.exportBackup()
      const text = JSON.stringify(data, null, 2)
      wx.setClipboardData({
        data: text,
        success: () => {
          wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
        }
      })
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ exporting: false })
    }
  },

  onAbout() {
    wx.showModal({
      title: '关于 Jarin衣柜',
      content: this.data.about,
      showCancel: false
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号？',
      success: (res) => {
        if (!res.confirm) return
        getApp().clearSession()
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  }
})
