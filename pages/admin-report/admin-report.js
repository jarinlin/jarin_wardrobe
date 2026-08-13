const api = require('../../src/assets/js/api')
const auth = require('../../src/assets/js/auth')
const { toDashboard } = require('../../src/assets/js/admin-report')

Page({
  data: {
    loading: true,
    denied: false,
    error: false,
    asOfLabel: '上海时区',
    sections: [],
    recentPosts: [],
    recentUsers: [],
    hasPosts: false,
    hasUsers: false
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.load(false)
  },

  onPullDownRefresh() {
    this.load(true)
  },

  onRetry() {
    this.load(false)
  },

  async load(fromPull) {
    if (!fromPull) {
      this.setData({ loading: true, denied: false, error: false })
    }
    try {
      const me = await api.fetchMe()
      if (!api.isAdminUser(me)) {
        this.setData({
          loading: false,
          denied: true,
          error: false,
          sections: [],
          recentPosts: [],
          recentUsers: [],
          hasPosts: false,
          hasUsers: false
        })
        return
      }
      const data = await api.fetchAdminReport()
      const dash = toDashboard(data)
      this.setData({
        loading: false,
        denied: false,
        error: false,
        asOfLabel: dash.asOf ? '上海时区 · ' + dash.asOf : '上海时区',
        sections: dash.sections,
        recentPosts: dash.recentPosts,
        recentUsers: dash.recentUsers,
        hasPosts: dash.recentPosts.length > 0,
        hasUsers: dash.recentUsers.length > 0
      })
    } catch (e) {
      const status = e && e.statusCode
      this.setData({
        loading: false,
        denied: status === 403,
        error: status !== 403,
        sections: fromPull ? this.data.sections : [],
        recentPosts: fromPull ? this.data.recentPosts : [],
        recentUsers: fromPull ? this.data.recentUsers : [],
        hasPosts: fromPull ? this.data.hasPosts : false,
        hasUsers: fromPull ? this.data.hasUsers : false
      })
    } finally {
      if (fromPull) {
        wx.stopPullDownRefresh()
      }
    }
  }
})
