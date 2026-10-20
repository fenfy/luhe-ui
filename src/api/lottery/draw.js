import request from '@/utils/request'

// 查询开奖记录
export function listDraw(query) {
  return request({
    url: '/lottery/draw/list',
    method: 'get',
    params: query
  })
}

// 赔付参考：每个号码作为特码时本期的赔付与占比（不影响开奖）
export function previewDraw(issueNo) {
  return request({
    url: '/lottery/draw/preview',
    method: 'get',
    params: { issueNo }
  })
}

// 执行开奖（随机开出；issueNo 可传期号或 YYYYMMDD 日期）
export function drawLottery(issueNo) {
  return request({
    url: '/lottery/draw',
    method: 'post',
    data: { issueNo }
  })
}

// 录入 / 修改号码：numbers 为 7 个号码，前 6 正码、第 7 特码
export function saveDrawNumbers(issueNo, numbers) {
  return request({
    url: '/lottery/draw/numbers',
    method: 'put',
    data: { issueNo, numbers }
  })
}
