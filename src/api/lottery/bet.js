import request from '@/utils/request'

// 投注选项（生肖、号码、色波、可选比例）
export function getLotteryOptions() {
  return request({
    url: '/lottery/bet/options',
    method: 'get'
  })
}

// 查询投注列表
export function listBet(query) {
  return request({
    url: '/lottery/bet/list',
    method: 'get',
    params: query
  })
}

// 某期汇总
export function getIssueSummary(issueNo) {
  return request({
    url: '/lottery/bet/summary',
    method: 'get',
    params: { issueNo }
  })
}

// 新增投注（betItems 多选，每项一条）
export function addBet(data) {
  return request({
    url: '/lottery/bet',
    method: 'post',
    data: data
  })
}

// 修改投注
export function updateBet(data) {
  return request({
    url: '/lottery/bet',
    method: 'put',
    data: data
  })
}

// 删除投注
export function delBet(betIds) {
  return request({
    url: '/lottery/bet/' + betIds,
    method: 'delete'
  })
}
