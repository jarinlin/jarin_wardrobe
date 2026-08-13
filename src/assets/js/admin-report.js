function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

/** 任意 ISO/时间戳按 Asia/Shanghai（UTC+8，无夏令时）显示 */
function shanghaiText(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) return raw.slice(0, 16)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const sh = new Date(d.getTime() + 8 * 3600 * 1000)
  return (
    sh.getUTCFullYear() +
    '-' +
    pad2(sh.getUTCMonth() + 1) +
    '-' +
    pad2(sh.getUTCDate()) +
    ' ' +
    pad2(sh.getUTCHours()) +
    ':' +
    pad2(sh.getUTCMinutes())
  )
}

function metric(label, value) {
  return { label, value: num(value) }
}

function toDashboard(data) {
  const src = data || {}
  const users = src.users || {}
  const clothes = src.clothes || {}
  const outfits = src.outfits || {}
  const plaza = src.plaza || {}
  const diet = src.diet || {}
  const kcalToday = num(diet.caloriesToday)
  const kcal7d = num(diet.caloriesLast7Days)
  const likes = num(plaza.likes)
  const recentPosts = (plaza.recent || []).map((p) => ({
    id: p.id,
    caption: p.caption || '无文案',
    nickname: p.nickname || '未设置昵称',
    likeCount: num(p.likeCount),
    createdAtText: shanghaiText(p.createdAtText || p.createdAt)
  }))
  const recentUsers = (src.recentUsers || []).map((u) => ({
    id: u.id,
    nickname: u.nickname || '未设置昵称',
    createdAtText: shanghaiText(u.createdAtText || u.createdAt)
  }))
  return {
    asOf: shanghaiText(src.asOf) || src.asOf || '',
    timezone: src.timezone || 'Asia/Shanghai',
    sections: [
      {
        title: '用户',
        extra: '',
        metrics: [
          metric('总数', users.total),
          metric('今日', users.today),
          metric('近7天', users.last7Days)
        ]
      },
      {
        title: '衣柜',
        extra: '',
        metrics: [
          metric('总数', clothes.total),
          metric('今日', clothes.today),
          metric('近7天', clothes.last7Days)
        ]
      },
      {
        title: '穿搭',
        extra: '',
        metrics: [
          metric('总数', outfits.total),
          metric('今日', outfits.today),
          metric('近7天', outfits.last7Days)
        ]
      },
      {
        title: '广场',
        extra: likes + ' 次点赞',
        metrics: [
          metric('总数', plaza.posts),
          metric('今日', plaza.postsToday),
          metric('近7天', plaza.postsLast7Days)
        ]
      },
      {
        title: '饮食',
        extra: '今日 ' + kcalToday + ' 大卡 · 近7天 ' + kcal7d + ' 大卡',
        metrics: [
          metric('总数', diet.total),
          metric('今日', diet.today),
          metric('近7天', diet.last7Days)
        ]
      }
    ],
    recentPosts,
    recentUsers
  }
}

module.exports = {
  toDashboard
}
