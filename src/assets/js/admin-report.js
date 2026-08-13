function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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
    createdAtText: p.createdAtText || ''
  }))
  const recentUsers = (src.recentUsers || []).map((u) => ({
    id: u.id,
    nickname: u.nickname || '未设置昵称',
    createdAtText: u.createdAtText || ''
  }))
  return {
    asOf: src.asOf || '',
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
