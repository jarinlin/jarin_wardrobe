const api = require('../../src/assets/js/api')
const upload = require('../../src/assets/js/upload')
const auth = require('../../src/assets/js/auth')
const util = require('../../src/assets/js/util')
const { RUN_MODE, BASE_URL, USE_MOCK, USE_CLOUD } = require('../../src/assets/js/config')

function isPlaceholderNick(name) {
  const n = (name || '').trim()
  return !n || n === '微信用户'
}

Page({
  data: {
    runMode: RUN_MODE,
    baseUrl: BASE_URL,
    modeLabel: '',
    about: 'Jarin衣柜 · 整理衣物、记录穿搭、饮食与身体档案',
    exporting: false,
    nickname: '',
    avatarUrl: '',
    defaultAvatar: '/src/assets/icons/mine-active.png',
    savingProfile: false,
    loggedIn: false
  },

  onShow() {
    let modeLabel = '本地后端'
    if (USE_MOCK) modeLabel = 'Mock 假数据'
    else if (USE_CLOUD) modeLabel = '微信云托管'
    const user = auth.getUserInfo() || {}
    const loggedIn = !!auth.getToken()
    this.setData({
      modeLabel,
      runMode: RUN_MODE,
      baseUrl: BASE_URL,
      loggedIn,
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || ''
    })
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
      if (formAvatar.indexOf('http') !== 0 && !USE_MOCK) {
        avatarUrl = await upload.uploadImage(formAvatar)
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
          wx.removeStorageSync('mock_clothes')
          wx.removeStorageSync('mock_outfits')
          wx.removeStorageSync('mock_categories')
          wx.removeStorageSync('mock_tags')
        } catch (e) {}
        wx.showToast({ title: '已清理', icon: 'success' })
      }
    })
  },

  async onExport() {
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
      title: '关于',
      content: this.data.about + '\n运行模式：' + this.data.modeLabel,
      showCancel: false
    })
  }
})
