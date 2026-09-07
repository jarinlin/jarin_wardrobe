const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('正式登录不把空 code 伪装成 mock_code', () => {
  const login = read('pages/login/login.js')
  const api = read('src/assets/js/api.js')
  assert.doesNotMatch(login, /mock_code/)
  assert.doesNotMatch(api, /res\.code \|\| ['"]mock_code['"]/)
})

test('云模式拒绝 mock openid 登录态', () => {
  const login = read('pages/login/login.js')
  assert.match(login, /mock_/)
  assert.match(login, /USE_MOCK/)
})

test('登录页在展示头像昵称前建立微信登录态', () => {
  const login = read('pages/login/login.js')
  const onLoad = login.match(/onLoad\(\)\s*\{([\s\S]*?)\n  \},/)
  assert.ok(onLoad, '应定义 onLoad')
  assert.match(onLoad[1], /ensureWxSession|wx\.login/)
})

test('完善资料允许只填昵称，并提供相册兜底', () => {
  const js = read('pages/login/login.js')
  const wxml = read('pages/login/login.wxml')
  assert.doesNotMatch(js, /请选择头像/)
  assert.match(js, /chooseMedia|chooseImage/)
  assert.match(wxml, /从相册|相册选择/)
  assert.match(wxml, /先进入|暂不完善/)
})
