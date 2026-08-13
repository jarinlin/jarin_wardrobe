/**
 * 运行模式：
 * - mock: 本地假数据，不连后端
 * - local: 调本机 Go 后端
 * - cloud: 微信云托管 callContainer（正式发布用这个）
 */
const RUN_MODE = 'cloud' // 'mock' | 'local' | 'cloud'

/** local：Go API 地址（真机预览请改成电脑局域网 IP） */
const BASE_URL = 'http://127.0.0.1:3000'

/**
 * cloud 模式：与微信云托管控制台一致
 * - CLOUD_ENV: 环境 ID（日志里 envId）
 * - CLOUD_SERVICE: 服务名（不是版本号，不要带 -002）
 */
const CLOUD_ENV = 'prod-d5grcb82q8a137e9c'
const CLOUD_SERVICE = 'warerobe-backend'

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
