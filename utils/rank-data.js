/** 排行榜：全国榜走 API */

var jigsawApi = require('./jigsaw-api')
var user = require('./user')

var nationalCache = {
  list: [],
  myRank: null,
  myEntry: null,
  loaded: false,
  loading: null,
  error: null
}

function invalidateCache() {
  nationalCache.loaded = false
  nationalCache.error = null
}

function applyRankPayload(data) {
  nationalCache.list = (data.list || []).map(mapNationalRow)
  nationalCache.myRank = data.myRank
  nationalCache.myEntry = buildMyNationalEntry(data)
  nationalCache.loaded = true
  nationalCache.error = null
}

function applyRankFailure(err) {
  console.warn('[rank] load national failed', err)
  nationalCache.loading = null
  nationalCache.loaded = true
  nationalCache.error = err || new Error('load failed')
  nationalCache.list = []
  if (!nationalCache.myEntry) {
    nationalCache.myEntry = buildMyNationalEntry({
      myRank: null,
      myCompletedCount: 0,
      myLastCompletedAt: null
    })
  }
}

function formatRankLabel(rank) {
  if (rank == null || rank === '' || rank === '—') return '100+'
  if (typeof rank === 'number') {
    if (rank > 100) return '100+'
    return rank
  }
  var n = parseInt(rank, 10)
  if (!isNaN(n) && n > 100) return '100+'
  return rank
}

function mapNationalRow(row) {
  return {
    rank: row.rank,
    name: user.resolveNickname(row.nickname),
    levels: row.completedCount,
    userId: row.userId,
    avatarUrl: user.resolveAvatarUrl(row.avatarUrl)
  }
}

function buildMyNationalEntry(data) {
  var rank = formatRankLabel(data.myRank)
  return {
    rank: rank,
    name: user.getNickname(),
    levels: data.myCompletedCount || 0,
    avatarUrl: user.getAvatarUrl()
  }
}

function loadNationalRank(force) {
  if (nationalCache.loading && !force) return nationalCache.loading
  if (force) invalidateCache()

  function fetchRank() {
    var userId = user.getUserId()
    if (!userId) {
      nationalCache.loaded = true
      nationalCache.list = []
      nationalCache.myEntry = buildMyNationalEntry({
        myRank: null,
        myCompletedCount: 0,
        myLastCompletedAt: null
      })
      nationalCache.loading = null
      return Promise.resolve(nationalCache)
    }

    nationalCache.loading = jigsawApi.fetchRank(userId, { limit: 100 }).then(function (data) {
      applyRankPayload(data)
      nationalCache.loading = null
      return nationalCache
    }).catch(function (err) {
      applyRankFailure(err)
      return nationalCache
    })
    return nationalCache.loading
  }

  if (!user.getUserId()) {
    nationalCache.loading = user.autoLogin().then(function () {
      return fetchRank()
    }).catch(function (err) {
      applyRankFailure(err)
      return nationalCache
    })
    return nationalCache.loading
  }

  return fetchRank()
}

function isNationalLoading() {
  return !!nationalCache.loading
}

function isNationalLoaded() {
  return nationalCache.loaded
}

function isNationalError() {
  return !!nationalCache.error
}

function getLeaderboard() {
  return nationalCache.loaded ? nationalCache.list : []
}

function getMyRank() {
  if (nationalCache.myEntry) return nationalCache.myEntry
  return buildMyNationalEntry({
    myRank: null,
    myCompletedCount: 0,
    myLastCompletedAt: null
  })
}

function refreshNational() {
  return loadNationalRank(true)
}

module.exports = {
  loadNationalRank: loadNationalRank,
  refreshNational: refreshNational,
  invalidateCache: invalidateCache,
  isNationalLoading: isNationalLoading,
  isNationalLoaded: isNationalLoaded,
  isNationalError: isNationalError,
  getLeaderboard: getLeaderboard,
  getMyRank: getMyRank,
  formatRankLabel: formatRankLabel
}
