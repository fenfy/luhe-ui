import request from '@/utils/request'

// 查询会员列表
export function listMemberUser(query) {
  return request({
    url: '/member/user/list',
    method: 'get',
    params: query
  })
}

// 查询会员详细
export function getMemberUser(userId) {
  return request({
    url: '/member/user/' + userId,
    method: 'get'
  })
}

// 会员状态修改
export function changeMemberUserStatus(userId, status) {
  const data = {
    userId,
    status
  }
  return request({
    url: '/member/user/changeStatus',
    method: 'put',
    data: data
  })
}

// 会员密码重置
export function resetMemberUserPwd(userId, password) {
  const data = {
    userId,
    password
  }
  return request({
    url: '/member/user/resetPwd',
    method: 'put',
    data: data
  })
}
