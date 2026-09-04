const api = require('../../src/assets/js/api')
const util = require('../../src/assets/js/util')

Page({
  data: {
    list: [],
    newName: '',
    busy: false
  },

  onShow() {
    if (!util.ensureLogin()) return
    this.loadList()
  },

  async loadList() {
    try {
      const list = await api.fetchCategories()
      this.setData({ list: list || [] })
    } catch (e) {
      wx.showToast({ title: '分类加载失败', icon: 'none' })
    }
  },

  onInput(e) {
    this.setData({ newName: e.detail.value })
  },

  async onAdd() {
    if (this.data.busy) return
    const name = (this.data.newName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    try {
      await api.createCategory(name)
      this.setData({ newName: '' })
      await this.loadList()
      wx.showToast({ title: '已添加', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  onRename(e) {
    if (this.data.busy) return
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '修改分类名',
      editable: true,
      placeholderText: '分类名称',
      content: name,
      success: async (res) => {
        if (!res.confirm || this.data.busy) return
        const next = (res.content || '').trim()
        if (!next) return
        this.setData({ busy: true })
        try {
          await api.updateCategory(id, next)
          await this.loadList()
        } catch (err) {
          wx.showToast({ title: '修改失败', icon: 'none' })
        } finally {
          this.setData({ busy: false })
        }
      }
    })
  },

  onDelete(e) {
    if (this.data.busy) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除分类',
      content: '删除后，已有衣物的分类需手动调整',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm || this.data.busy) return
        this.setData({ busy: true })
        try {
          await api.deleteCategory(id)
          await this.loadList()
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          this.setData({ busy: false })
        }
      }
    })
  }
})
