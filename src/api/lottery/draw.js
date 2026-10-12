import request from '@/utils/request'

// 查询开奖记录
export function listDraw(query) {
  return request({
    url: '/lottery/draw/list',
    method: 'get',
    params: query
  })
}

// 开奖预览（每个号码的赔付、是否满足上限、是否候选）
export function previewDraw(issueNo, ratio) {
  return request({
    url: '/lottery/draw/preview',
    method: 'get',
    params: { issueNo, ratio }
  })
}

// 执行开奖
export function drawLottery(issueNo, ratio) {
  return request({
    url: '/lottery/draw',
    method: 'post',
    data: { issueNo, ratio }
  })
}
