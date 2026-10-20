<template>
  <div class="app-container">
    <el-radio-group v-model="activeLottery" class="lottery-switch" @change="handleQuery">
      <el-radio-button v-for="g in games" :key="g.code" :value="g.code">{{ g.name }}</el-radio-button>
    </el-radio-group>

    <el-tabs v-model="activeType" @tab-change="handleQuery">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane v-for="dict in app_gallery_type" :key="dict.value" :label="dict.label" :name="dict.value" />
    </el-tabs>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Upload" @click="handleUpload" v-hasPermi="['gallery:image:add']">上传</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="selectedIds.length === 0" @click="handleDelete()" v-hasPermi="['gallery:image:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5" v-if="canRemove && imageList.length > 0" class="select-all">
        <el-checkbox :model-value="isAllSelected" :indeterminate="isIndeterminate" @change="toggleSelectAll">全选本页</el-checkbox>
        <span v-if="selectedIds.length > 0" class="selected-tip">已选 {{ selectedIds.length }} 张</span>
      </el-col>
      <right-toolbar :search="false" @queryTable="getList"></right-toolbar>
    </el-row>

    <div v-loading="loading" class="gallery-body">
      <el-row :gutter="16" v-if="imageList.length > 0">
        <el-col v-for="(item, index) in imageList" :key="item.imageId" :xs="12" :sm="8" :md="6" :lg="4" class="gallery-col">
          <div class="gallery-card" :class="{ 'is-selected': selectedIds.includes(item.imageId) }">
            <el-checkbox
              v-if="canRemove"
              class="card-check"
              :model-value="selectedIds.includes(item.imageId)"
              @change="toggleSelect(item.imageId)"
            />
            <el-image
              class="card-image"
              :src="imageUrl(item.imagePath)"
              fit="cover"
              loading="lazy"
              :preview-src-list="previewList"
              :initial-index="index"
              preview-teleported
            >
              <template #error>
                <div class="image-slot"><el-icon><picture-filled /></el-icon></div>
              </template>
            </el-image>
            <div class="card-info">
              <div class="card-title">
                <dict-tag :options="app_gallery_type" :value="item.imageType" />
                <span class="card-name" :title="item.originalName">{{ item.originalName }}</span>
              </div>
              <div class="card-meta">
                <span>{{ gameName(item.lotteryCode) }} · {{ formatSize(item.fileSize) }}</span>
                <span>{{ parseTime(item.createTime, '{y}-{m}-{d} {h}:{i}') }}</span>
              </div>
              <div class="card-actions">
                <el-button link type="primary" icon="Link" @click="handleCopy(item)">复制链接</el-button>
                <el-button link type="danger" icon="Delete" @click="handleDelete(item)" v-hasPermi="['gallery:image:remove']">删除</el-button>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
      <el-empty v-else-if="!loading" description="暂无图片" />
    </div>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      :page-sizes="[24, 48, 96]"
      @pagination="getList"
    />

    <!-- 上传图片对话框 -->
    <el-dialog title="上传图片" v-model="upload.open" width="640px" append-to-body :close-on-click-modal="false" @closed="resetUpload">
      <el-form ref="uploadRef" :model="upload.form" :rules="upload.rules" label-width="80px">
        <el-form-item label="彩种" prop="lotteryCode">
          <el-radio-group v-model="upload.form.lotteryCode" :disabled="upload.uploading">
            <el-radio-button v-for="g in games" :key="g.code" :value="g.code">{{ g.name }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图片类型" prop="imageType">
          <el-select v-model="upload.form.imageType" placeholder="请选择图片类型" style="width: 240px">
            <el-option v-for="dict in app_gallery_type" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择图片" required>
          <el-upload
            v-model:file-list="upload.fileList"
            list-type="picture-card"
            accept=".jpg,.jpeg,.png"
            multiple
            :limit="MAX_COUNT"
            :auto-upload="false"
            :disabled="upload.uploading"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
          >
            <el-icon><plus /></el-icon>
          </el-upload>
          <div class="el-upload__tip">
            一次最多 {{ MAX_COUNT }} 张，仅支持 <b style="color: #f56c6c">jpg / png</b> 格式，单张不超过 <b style="color: #f56c6c">2M</b>
          </div>
          <div v-if="upload.failures.length > 0" class="upload-failures">
            <div v-for="f in upload.failures" :key="f.uid">「{{ f.name }}」上传失败：{{ f.reason }}</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="upload.uploading" @click="submitUpload">开始上传</el-button>
          <el-button @click="upload.open = false" :disabled="upload.uploading">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="GalleryImage">
import { ElMessage } from "element-plus"
import { checkPermi } from "@/utils/permission"
import { listGalleryGames, listGalleryImage, uploadGalleryImage, delGalleryImage } from "@/api/gallery/image"

const { proxy } = getCurrentInstance()
const { app_gallery_type } = useDict("app_gallery_type")

/** 单张图片大小上限：2M（与后端一致） */
const MAX_SIZE = 2 * 1024 * 1024
/** 一次最多上传张数 */
const MAX_COUNT = 9
/** 允许的扩展名 */
const ALLOWED_EXTENSION = ["jpg", "jpeg", "png"]

const baseApi = import.meta.env.VITE_APP_BASE_API
const canRemove = checkPermi(["gallery:image:remove"])

const imageList = ref([])
const loading = ref(true)
const total = ref(0)
const activeType = ref("all")
/** 彩种：接口返回前先用这份，名称以后端为准 */
const games = ref([
  { code: "yd", name: "云顶六合彩", shortName: "马彩" },
  { code: "xam", name: "新澳门六合彩", shortName: "澳彩" },
  { code: "hk", name: "香港六合彩", shortName: "港彩" }
])
const activeLottery = ref("yd")
const selectedIds = ref([])

const queryParams = ref({
  pageNum: 1,
  pageSize: 24,
  lotteryCode: undefined,
  imageType: undefined
})

const upload = reactive({
  open: false,
  uploading: false,
  fileList: [],
  failures: [],
  form: { lotteryCode: undefined, imageType: undefined },
  rules: {
    lotteryCode: [{ required: true, message: "请选择彩种", trigger: "change" }],
    imageType: [{ required: true, message: "请选择图片类型", trigger: "change" }]
  }
})

const previewList = computed(() => imageList.value.map(item => imageUrl(item.imagePath)))
const isAllSelected = computed(() => imageList.value.length > 0 && imageList.value.every(item => selectedIds.value.includes(item.imageId)))
const isIndeterminate = computed(() => selectedIds.value.length > 0 && !isAllSelected.value)

/** 查询图片列表 */
function getList() {
  loading.value = true
  queryParams.value.lotteryCode = activeLottery.value
  queryParams.value.imageType = activeType.value === "all" ? undefined : activeType.value
  listGalleryImage(queryParams.value).then(res => {
    imageList.value = res.rows
    total.value = res.total
    selectedIds.value = []
  }).finally(() => {
    loading.value = false
  })
}

/** 切换类型 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 图片访问地址（相对路径拼接接口前缀） */
function imageUrl(path) {
  return baseApi + path
}

/** 完整链接（带域名），用于复制 */
function fullUrl(path) {
  const url = imageUrl(path)
  return /^https?:\/\//.test(url) ? url : window.location.origin + url
}

function formatSize(size) {
  if (!size) return "0 B"
  if (size < 1024) return size + " B"
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB"
  return (size / 1024 / 1024).toFixed(2) + " MB"
}

/** 勾选单张 */
function toggleSelect(imageId) {
  const index = selectedIds.value.indexOf(imageId)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(imageId)
  }
}

/** 全选/取消全选本页 */
function toggleSelectAll(checked) {
  selectedIds.value = checked ? imageList.value.map(item => item.imageId) : []
}

/** 复制链接 */
function handleCopy(item) {
  const text = fullUrl(item.imagePath)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => ElMessage({ message: "链接已复制", type: "success", duration: 1500 }))
  } else {
    const ta = document.createElement("textarea")
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
    ElMessage({ message: "链接已复制", type: "success", duration: 1500 })
  }
}

/** 删除（单张或批量） */
function handleDelete(item) {
  const ids = item ? [item.imageId] : selectedIds.value
  if (ids.length === 0) return
  const tip = item ? '确认删除图片「' + item.originalName + '」吗？' : "确认删除选中的 " + ids.length + " 张图片吗？"
  proxy.$modal.confirm(tip + "删除后图片链接将失效，且无法恢复。").then(() => {
    return delGalleryImage(ids.join(","))
  }).then(() => {
    // 当前页删空时回到上一页
    if (ids.length >= imageList.value.length && queryParams.value.pageNum > 1) {
      queryParams.value.pageNum--
    }
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {})
}

/** 打开上传对话框：默认选中当前标签页的类型 */
function handleUpload() {
  upload.form.lotteryCode = activeLottery.value
  upload.form.imageType = activeType.value === "all" ? undefined : activeType.value
  upload.open = true
}

/** 选择文件时先在前端校验格式和大小 */
function handleFileChange(file, fileList) {
  const ext = (file.name.split(".").pop() || "").toLowerCase()
  let reason = ""
  if (!ALLOWED_EXTENSION.includes(ext)) {
    reason = "只能上传 jpg 或 png 格式的图片"
  } else if (file.size > MAX_SIZE) {
    reason = "图片大小不能超过 2M"
  }
  if (reason) {
    proxy.$modal.msgError("「" + file.name + "」" + reason)
    const index = fileList.indexOf(file)
    if (index > -1) fileList.splice(index, 1)
  }
}

function handleExceed() {
  proxy.$modal.msgWarning("一次最多上传 " + MAX_COUNT + " 张图片")
}

/** 逐张上传；成功的从列表移除，失败的保留并显示原因 */
function submitUpload() {
  proxy.$refs["uploadRef"].validate(async valid => {
    if (!valid) return
    const pending = upload.fileList.filter(f => f.status !== "success")
    if (pending.length === 0) {
      proxy.$modal.msgWarning("请选择要上传的图片")
      return
    }
    upload.uploading = true
    upload.failures = []
    let successCount = 0
    for (const file of pending) {
      file.status = "uploading"
      try {
        await uploadGalleryImage(file.raw, upload.form.lotteryCode, upload.form.imageType)
        file.status = "success"
        successCount++
      } catch (e) {
        file.status = "ready"
        upload.failures.push({ uid: file.uid, name: file.name, reason: (e && e.message) || "上传失败" })
      }
    }
    upload.fileList = upload.fileList.filter(f => f.status !== "success")
    upload.uploading = false
    if (successCount > 0) {
      // 切到刚上传的彩种，便于查看
      activeLottery.value = upload.form.lotteryCode
      queryParams.value.pageNum = 1
      getList()
    }
    if (upload.failures.length === 0) {
      proxy.$modal.msgSuccess("成功上传 " + successCount + " 张图片")
      upload.open = false
    } else {
      proxy.$modal.msgWarning("成功 " + successCount + " 张，失败 " + upload.failures.length + " 张")
    }
  })
}

function resetUpload() {
  upload.fileList = []
  upload.failures = []
  upload.uploading = false
  proxy.resetForm("uploadRef")
}

/** 彩种名称（卡片上显示简称） */
function gameName(code) {
  const g = games.value.find(x => x.code === code)
  return g ? g.shortName : code
}

onMounted(() => {
  getList()
  listGalleryGames().then(res => {
    if (Array.isArray(res.data) && res.data.length) games.value = res.data
  }).catch(() => {})
})
</script>

<style scoped lang="scss">
.lottery-switch {
  margin-bottom: 8px;
}

.select-all {
  display: flex;
  align-items: center;
  margin-left: 8px;

  .selected-tip {
    margin-left: 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

.gallery-body {
  min-height: 200px;
}

.gallery-col {
  margin-bottom: 16px;
}

.gallery-card {
  position: relative;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-bg-color);
  transition: box-shadow 0.2s, border-color 0.2s;

  &:hover {
    box-shadow: var(--el-box-shadow-light);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
  }

  .card-check {
    position: absolute;
    top: 6px;
    left: 8px;
    z-index: 2;
    height: auto;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.85);
  }

  .card-image {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: var(--el-fill-color-light);
    cursor: zoom-in;
  }

  .image-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 28px;
    color: var(--el-text-color-placeholder);
  }

  .card-info {
    padding: 8px 10px 6px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;

    .card-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 13px;
    }
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .card-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
  }
}

.upload-failures {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  line-height: 20px;
  color: var(--el-color-danger);
}
</style>
