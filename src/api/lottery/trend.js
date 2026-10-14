import request from '@/utils/request'

// 走势统计：type = special（特码）/ normal（正码），periods = 10/20/30/50/100
export function getTrend(type, periods) {
  return request({
    url: '/lottery/trend',
    method: 'get',
    params: { type, periods }
  })
}
