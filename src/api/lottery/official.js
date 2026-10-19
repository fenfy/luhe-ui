import request from '@/utils/request'

// 官方开奖列表（lotteryCode：xam 新澳门 / hk 香港）
export function listOfficial(query) {
  return request({
    url: '/lottery/official/list',
    method: 'get',
    params: query
  })
}

// 新增一期（香港排期）
export function addOfficial(data) {
  return request({
    url: '/lottery/official',
    method: 'post',
    data
  })
}

// 修改（香港：期号、开奖时间；两个彩种：视频地址、备注）
export function updateOfficial(data) {
  return request({
    url: '/lottery/official',
    method: 'put',
    data
  })
}

// 录入 / 修改号码（仅香港）：numbers 为 7 个号码，前 6 正码、第 7 特码
export function saveOfficialNumbers(drawId, numbers) {
  return request({
    url: '/lottery/official/numbers',
    method: 'put',
    data: { drawId, numbers }
  })
}

// 删除待开奖的期（仅香港）
export function delOfficial(drawIds) {
  return request({
    url: '/lottery/official/' + drawIds,
    method: 'delete'
  })
}

// 重新同步一期（仅新澳门）
export function resyncOfficial(drawId) {
  return request({
    url: '/lottery/official/resync/' + drawId,
    method: 'post'
  })
}

// 同步新澳门最新一期
export function syncOfficialLatest() {
  return request({
    url: '/lottery/official/sync-latest',
    method: 'post'
  })
}

// 补新澳门历史（from：YYYY-MM-DD），只补缺失的期
export function syncOfficialHistory(from) {
  return request({
    url: '/lottery/official/sync-history',
    method: 'post',
    params: { from },
    timeout: 120000
  })
}
