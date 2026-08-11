const { Pool } = require('pg')
const config = require('./config')

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10
})

/** 将 :name 命名参数转为 pg 的 $1/$2 */
function toPg(sql, params = {}) {
  const values = []
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key) => {
    if (!(key in params)) {
      throw new Error(`缺少 SQL 参数: ${key}`)
    }
    values.push(params[key])
    return `$${values.length}`
  })
  return { text, values }
}

async function query(sql, params = {}) {
  const { text, values } = toPg(sql, params)
  const result = await pool.query(text, values)
  return result.rows
}

module.exports = {
  pool,
  query
}
