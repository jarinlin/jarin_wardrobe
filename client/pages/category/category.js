const api = require('../../src/assets/js/api')

Page({
  data: {
    list: [],
    newName: ''
  },

  onShow() {
    this.loadList()
  },

  async loadList() {
    const list = await api.fetchCategories()
    this.setData({ list })
  },

  onInput(e) {
    this.setData({ newName: e.detail.value })
  },

  async onAdd() {
    const name = (this.data.newName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    await api.createCategory(name)
    this.setData({ newName: '' })
    this.loadList()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onRename(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '修改分类名',
      editable: true,
      placeholderText: '分类名称',
      content: name,
      success: async (res) => {
        if (!res.confirm) return
        const next = (res.content || '').trim()
        if (!next) return
        await api.updateCategory(id, next)
        this.loadList()
      }
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除分类',
      content: '删除后，已有衣物的分类需手动调整',
      confirmColor: '#B54A3A',
      success: async (res) => {
        if (!res.confirm) return
        await api.deleteCategory(id)
        this.loadList()
      }
    })
  }
})
