const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('启动和四个 Tab 不在 onShow 强制登录', () => {
  assert.doesNotMatch(read('app.js'), /auth\.requireLogin\(\)/)

  for (const file of [
    'pages/index/index.js',
    'pages/wardrobe/wardrobe.js',
    'pages/outfit/outfit.js',
    'pages/diet/diet.js'
  ]) {
    const source = read(file)
    const onShow = source.match(/onShow\(\)\s*\{([\s\S]*?)\n\s*\},/)
    assert.ok(onShow, `${file} 应定义 onShow`)
    assert.doesNotMatch(onShow[1], /requireLogin/, `${file} 的 onShow 不应强制登录`)
  }
})

test('登录引导可返回，登录成功按页面栈返回', () => {
  const auth = read('src/assets/js/auth.js')
  assert.match(auth, /wx\.navigateTo\(\s*\{\s*url:\s*['"]\/pages\/login\/login['"]/)
  assert.doesNotMatch(auth, /wx\.reLaunch\(/)

  const login = read('pages/login/login.js')
  assert.match(login, /getCurrentPages\(\)/)
  assert.match(login, /wx\.navigateBack\(/)
  assert.match(login, /wx\.switchTab\(\s*\{\s*url:\s*['"]\/pages\/index\/index['"]/)
})

test('游客 Tab 具备登录状态门控和独立空态', () => {
  assert.match(read('pages/wardrobe/wardrobe.wxml'), /登录后开始收录衣物/)
  assert.match(read('pages/outfit/outfit.wxml'), /登录后记录穿搭/)
  assert.match(read('pages/outfit/outfit.wxml'), /登录后看大家的穿搭/)
  assert.match(read('pages/diet/diet.wxml'), /登录后即可记饮食/)

  for (const file of [
    'pages/index/index.js',
    'pages/wardrobe/wardrobe.js',
    'pages/outfit/outfit.js',
    'pages/diet/diet.js',
    'pages/settings/settings.js'
  ]) {
    assert.match(read(file), /auth\.isLoggedIn\(\)/, `${file} 应检查游客状态`)
  }
})
