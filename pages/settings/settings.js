const { RUN_MODE, BASE_URL, USE_MOCK, USE_CLOUD } = require('../../src/assets/js/config')

Page({
  data: {
    runMode: RUN_MODE,
    baseUrl: BASE_URL,
    modeLabel: '',
    about: 'Jarin衣柜 · 整理衣物、记录穿搭、饮食与身体档案'
  },

  onShow() {
    let modeLabel = '本地后端'
    if (USE_MOCK) modeLabel = 'Mock 假数据'
    else if (USE_CLOUD) modeLabel = '微信云托管'
    this.setData({ modeLabel, runMode: RUN_MODE, baseUrl: BASE_URL })
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
          wx.removeStorageSync('mock_clothes')
          wx.removeStorageSync('mock_outfits')
          wx.removeStorageSync('mock_categories')
          wx.removeStorageSync('mock_tags')
        } catch (e) {}
        wx.showToast({ title: '已清理', icon: 'success' })
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: this.data.about + '\n运行模式：' + this.data.modeLabel,
      showCancel: false
    })
  }
})
