import request from '@/utils/request'

// 查询开奖记录
export function listDraw(query) {
  return request({
    url: '/lottery/draw/list',
    method: 'get',
    params: query
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
