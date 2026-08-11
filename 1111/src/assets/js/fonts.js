/**
 * 加载小米开源字体 MiSans（子集 WOFF）
 * 来源：https://hyperos.mi.com/font/zh/
 * 本项目已在界面与文档中注明使用了 MiSans。
 */
const FACES = [
  {
    family: 'MiSans',
    source: 'url("src/assets/fonts/MiSans-Regular.woff")',
    desc: { style: 'normal', weight: '400' }
  },
  {
    family: 'MiSans',
    source: 'url("src/assets/fonts/MiSans-Medium.woff")',
    desc: { style: 'normal', weight: '500' }
  }
]

function loadOne(face) {
  return new Promise((resolve) => {
    if (!wx.loadFontFace) {
      resolve(false)
      return
    }
    wx.loadFontFace({
      global: true,
      family: face.family,
      source: face.source,
      desc: face.desc,
      scopes: ['webview', 'native'],
      success() {
        resolve(true)
      },
      fail(err) {
        console.warn('[font] load failed', face.source, err)
        resolve(false)
      }
    })
  })
}

function loadMiSans() {
  return Promise.all(FACES.map(loadOne))
}

module.exports = {
  loadMiSans
}
