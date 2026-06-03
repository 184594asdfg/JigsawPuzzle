/** 排行榜：全国榜走 API，好友榜暂用静态占位 */

var jigsawApi = require('./jigsaw-api')
var user = require('./user')

var FRIENDS_LEADERBOARD = [
  { rank: 1, name: '阿杰', levels: 18, time: '12:08' },
  { rank: 2, name: '小雨', levels: 15, time: '14:22' },
  { rank: 3, name: '我', levels: 12, time: '16:40' },
  { rank: 4, name: '大明', levels: 11, time: '18:05' },
  { rank: 5, name: 'Cici', levels: 9, time: '19:33' }
]

var nationalCache = {
  list: [],
  myRank: null,
  myEntry: null,
  loaded: false,
  loading: null
}

function formatRankTime(iso) {
  if (!iso) return '--'
  try {
    var d = new Date(iso)
    if (isNaN(d.getTime())) return '--'
    var h = d.getHours()
    var m = d.getMinutes()
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
  } catch (e) {
    return '--'
  }
}

function mapNationalRow(row) {
  return {
    rank: row.rank,
    name: row.nickname || '玩家',
    levels: row.completedCount,
    time: formatRankTime(row.lastCompletedAt),
    userId: row.userId,
    avatarUrl: row.avatarUrl || ''
  }
}

function buildMyNationalEntry(data) {
  var display = user.getDisplayInfo()
  if (data.myRank == null || !data.myCompletedCount) {
    return {
      rank: '—',
      name: display.name || '我',
      levels: data.myCompletedCount || 0,
      time: '--'
    }
  }
  return {
    rank: data.myRank,
    name: display.name || '我',
    levels: data.myCompletedCount,
    time: formatRankTime(data.myLastCompletedAt)
  }
}

function loadNationalRank(force) {
  if (nationalCache.loading && !force) return nationalCache.loading
  var userId = user.getUserId()
  if (!userId) {
    nationalCache.loaded = true
    nationalCache.list = []
    nationalCache.myEntry = buildMyNationalEntry({
      myRank: null,
      myCompletedCount: 0,
      myLastCompletedAt: null
    })
    return Promise.resolve(nationalCache)
  }
  nationalCache.loading = jigsawApi.fetchRank(userId, { limit: 100 }).then(function (data) {
    nationalCache.list = (data.list || []).map(mapNationalRow)
    nationalCache.myRank = data.myRank
    nationalCache.myEntry = buildMyNationalEntry(data)
    nationalCache.loaded = true
    nationalCache.loading = null
    return nationalCache
  }).catch(function (err) {
    console.warn('[rank] load national failed', err)
    nationalCache.loading = null
    if (!nationalCache.loaded) {
      nationalCache.myEntry = buildMyNationalEntry({
        myRank: null,
        myCompletedCount: 0,
        myLastCompletedAt: null
      })
    }
    return nationalCache
  })
  return nationalCache.loading
}

function isNationalLoading() {
  return !!nationalCache.loading
}

function isNationalLoaded() {
  return nationalCache.loaded
}

function getLeaderboard(tab) {
  if (tab === 'national') {
    return nationalCache.loaded ? nationalCache.list : []
  }
  return FRIENDS_LEADERBOARD
}

function getMyRank(tab) {
  if (tab === 'national') {
    if (nationalCache.myEntry) return nationalCache.myEntry
    return buildMyNationalEntry({
      myRank: null,
      myCompletedCount: 0,
      myLastCompletedAt: null
    })
  }
  return FRIENDS_LEADERBOARD[2] || {
    rank: '—',
    name: user.getDisplayInfo().name || '我',
    levels: 0,
    time: '--'
  }
}

function refreshNational() {
  nationalCache.loaded = false
  return loadNationalRank(true)
}

module.exports = {
  loadNationalRank: loadNationalRank,
  refreshNational: refreshNational,
  isNationalLoading: isNationalLoading,
  isNationalLoaded: isNationalLoaded,
  getLeaderboard: getLeaderboard,
  getMyRank: getMyRank
}
