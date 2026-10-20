import request from '@/utils/request'

// 彩种列表 [{ code, name, shortName }]
export function listGalleryGames() {
  return request({
    url: '/gallery/image/games',
    method: 'get'
  })
}

// 查询图片列表（lotteryCode 彩种、imageType 类型）
export function listGalleryImage(query) {
  return request({
    url: '/gallery/image/list',
    method: 'get',
    params: query
  })
}

// 上传图片（一次一张）
export function uploadGalleryImage(file, lotteryCode, imageType) {
  const data = new FormData()
  data.append('file', file)
  data.append('lotteryCode', lotteryCode)
  data.append('imageType', imageType)
  return request({
    url: '/gallery/image/upload',
    method: 'post',
    data: data,
    // FormData 序列化后都是 {}，连续上传会被防重复提交拦截，这里关闭
    headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false }
  })
}

// 删除图片（可批量）
export function delGalleryImage(imageIds) {
  return request({
    url: '/gallery/image/' + imageIds,
    method: 'delete'
  })
}
