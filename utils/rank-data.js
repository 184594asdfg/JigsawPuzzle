/** 静态排行榜：好友榜 / 全国榜 */

var FRIENDS_LEADERBOARD = [
  { rank: 1, name: '阿杰', levels: 18, time: '12:08' },
  { rank: 2, name: '小雨', levels: 15, time: '14:22' },
  { rank: 3, name: '我', levels: 12, time: '16:40' },
  { rank: 4, name: '大明', levels: 11, time: '18:05' },
  { rank: 5, name: 'Cici', levels: 9, time: '19:33' },
  { rank: 6, name: '老张', levels: 8, time: '21:17' },
  { rank: 7, name: '乐乐', levels: 6, time: '23:50' },
  { rank: 8, name: '柚子', levels: 5, time: '25:12' }
]

var NATIONAL_LEADERBOARD = [
  { rank: 1, name: '吉吉战神', levels: 96, time: '15:28' },
  { rank: 2, name: '闯关达人柒柒', levels: 91, time: '16:02' },
  { rank: 3, name: '华东第一拼', levels: 88, time: '17:19' },
  { rank: 4, name: '猫猫拼拼侠', levels: 84, time: '18:44' },
  { rank: 5, name: '早睡的企鹅', levels: 79, time: '19:30' },
  { rank: 6, name: '南风不干饭', levels: 74, time: '20:55' },
  { rank: 7, name: '图图妈妈', levels: 70, time: '22:08' },
  { rank: 8, name: '退休老王', levels: 66, time: '23:41' },
  { rank: 9, name: '考研回血中', levels: 61, time: '25:16' },
  { rank: 10, name: '奶茶半糖', levels: 57, time: '26:33' }
]

var MY_RANK_FRIENDS = {
  rank: 3,
  name: '我',
  levels: 12,
  time: '16:40'
}

var MY_RANK_NATIONAL = {
  rank: 256,
  name: '我',
  levels: 12,
  time: '42:18'
}

function getLeaderboard(tab) {
  return tab === 'national' ? NATIONAL_LEADERBOARD : FRIENDS_LEADERBOARD
}

function getMyRank(tab) {
  return tab === 'national' ? MY_RANK_NATIONAL : MY_RANK_FRIENDS
}

module.exports = {
  FRIENDS_LEADERBOARD: FRIENDS_LEADERBOARD,
  NATIONAL_LEADERBOARD: NATIONAL_LEADERBOARD,
  MY_RANK_FRIENDS: MY_RANK_FRIENDS,
  MY_RANK_NATIONAL: MY_RANK_NATIONAL,
  getLeaderboard: getLeaderboard,
  getMyRank: getMyRank
}
