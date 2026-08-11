const express = require('express')
const cors = require('cors')
const config = require('./config')
const { initDb } = require('./initDb')

const authRoutes = require('./routes/auth')
const categoryRoutes = require('./routes/categories')
const clothesRoutes = require('./routes/clothes')
const outfitRoutes = require('./routes/outfits')
const statsRoutes = require('./routes/stats')
const tagRoutes = require('./routes/tags')

async function bootstrap() {
  await initDb()

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.get('/health', (req, res) => {
    res.json({ ok: true, name: 'Jarin衣柜 API' })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/categories', categoryRoutes)
  app.use('/api/clothes', clothesRoutes)
  app.use('/api/outfits', outfitRoutes)
  app.use('/api/stats', statsRoutes)
  app.use('/api/tags', tagRoutes)

  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ code: 500, message: '服务器错误', data: null })
  })

  app.listen(config.port, () => {
    console.log(`Jarin衣柜 API 已启动: http://127.0.0.1:${config.port}`)
  })
}

bootstrap().catch((err) => {
  console.error('[db] 初始化失败，服务未启动:', err.message)
  process.exit(1)
})
