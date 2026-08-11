/**
 * 运行模式：
 * - mock: 本地假数据，不连后端（新手先玩界面）
 * - local: 本地/自建服务器，用 wx.request + BASE_URL
 * - cloud: 微信云托管，用 wx.cloud.callContainer（推荐上线方式）
 */
const RUN_MODE = 'local' // 'mock' | 'local' | 'cloud'

/** local 模式：本机或局域网后端地址（真机调试请改成电脑 IP） */
const BASE_URL = 'http://127.0.0.1:3000'

/**
 * cloud 模式：在微信云托管控制台查看
 * - CLOUD_ENV: 环境 ID，形如 prod-xxxxx
 * - CLOUD_SERVICE: 服务名称（创建服务时填的名字，如 jarin-api）
 */
const CLOUD_ENV = ''
const CLOUD_SERVICE = 'jarin-api'

const USE_MOCK = RUN_MODE === 'mock'
const USE_CLOUD = RUN_MODE === 'cloud'

module.exports = {
  RUN_MODE,
  BASE_URL,
  CLOUD_ENV,
  CLOUD_SERVICE,
  USE_MOCK,
  USE_CLOUD
}
