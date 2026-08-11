/**
 * 运行模式：
 * - mock: 本地假数据，不连后端
 * - local: 调本机 Go 后端（当前联调使用这个）
 * - cloud: 微信云托管 callContainer
 *
 * 后端已启动时请保持 local，勿改回 mock。
 */
const RUN_MODE = 'local' // 'mock' | 'local' | 'cloud'

/** local：Go API 地址（真机预览请改成电脑局域网 IP） */
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
