const DEFAULT_AVATAR = '/src/assets/icons/mine-active.png'

function feedQuery(feedKey) {
  if (feedKey === 'all') return { sort: 'hot', range: 'all' }
  if (feedKey === 'new') return { sort: 'new', range: 'all' }
  return { sort: 'hot', range: 'week' }
}

function normalizePost(p = {}) {
  const author = p.author || {}
  const names = Array.isArray(p.itemNames) ? p.itemNames : []
  const caption = p.caption || ''
  const imageUrl = p.imageUrl || ''
  const rank = Number(p.rank) || 0
  return {
    ...p,
    author: {
      nickname: author.nickname || '用户',
      avatarUrl: author.avatarUrl || ''
    },
    itemNames: names,
    itemTags: names.map((name, i) => ({ i, name })),
    likeCount: Number(p.likeCount) || 0,
    liked: !!p.liked,
    caption,
    imageUrl,
    rank,
    hasPhoto: !!imageUrl,
    hasCaption: !!caption,
    hasItems: names.length > 0
  }
}

function decorateFeedPost(p, feedKey) {
  const n = normalizePost(p)
  const rank = Number(n.rank) || 0
  return {
    ...n,
    showRank: feedKey !== 'new' && rank >= 1 && rank <= 3
  }
}

function hasPublishContent(showPhoto, showCaption, showItems, hasImage, caption, itemCount) {
  if (showPhoto && hasImage) return true
  if (showCaption && String(caption || '').trim()) return true
  if (showItems && itemCount > 0) return true
  return false
}

/** 记录页勾选发布时，与发布页默认勾选一致：有图带图、有备注带文案、单品名默认开 */
function plazaPayloadFromLook(outfitId, imageUrl, note, itemCount) {
  const caption = String(note || '')
  const hasImage = !!String(imageUrl || '').trim()
  const showPhoto = hasImage
  const showCaption = !!caption.trim()
  const showItems = Number(itemCount) > 0
  return {
    outfitId: Number(outfitId),
    showPhoto,
    showCaption,
    showItems,
    caption
  }
}

function toLookCard(o, formatDisplayDate) {
  const clothes = o.clothes || []
  const thumbs = clothes.slice(0, 4).map((c, i) => ({
    id: c.id,
    imageUrl: c.imageUrl || '',
    name: c.name || '',
    more: i === 3 && clothes.length > 4 ? clothes.length - 4 : 0
  }))
  return {
    ...o,
    dateLabel: formatDisplayDate(o.date),
    hasCover: !!o.imageUrl,
    thumbs,
    thumbN: thumbs.length
  }
}

module.exports = {
  DEFAULT_AVATAR,
  feedQuery,
  normalizePost,
  decorateFeedPost,
  hasPublishContent,
  plazaPayloadFromLook,
  toLookCard
}
