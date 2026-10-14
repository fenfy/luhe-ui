import request from '@/utils/request'

// 查询图片列表
export function listGalleryImage(query) {
  return request({
    url: '/gallery/image/list',
    method: 'get',
    params: query
  })
}

// 上传图片（一次一张）
export function uploadGalleryImage(file, imageType) {
  const data = new FormData()
  data.append('file', file)
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
