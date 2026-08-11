require('dotenv').config()

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'jarin_wardrobe_dev_secret',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jarin_wardrobe'
  },
  wx: {
    appId: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || ''
  },
  allowMockLogin: String(process.env.ALLOW_MOCK_LOGIN || 'true') === 'true'
}
