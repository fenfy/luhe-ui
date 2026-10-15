<template>
  <div class="app-container">
    <el-radio-group v-model="queryParams.lotteryCode" class="mb8" @change="handleQuery">
      <el-radio-button value="am">澳门六合彩</el-radio-button>
      <el-radio-button value="hk">香港六合彩</el-radio-button>
    </el-radio-group>
    <div class="lottery-tip">
      <template v-if="isHk">香港六合彩没有自动数据源：先「新增排期」（期号 + 开奖时间），开奖后「录入号码」；历史数据可用「批量导入」。到了开奖时间且已录入号码的期才会在 H5 显示。</template>
      <template v-else>澳门六合彩每天 22:32 起自动同步，号码不能手改；同步有误时点「重新同步」。首次使用请点「同步历史」补齐 2025-01-01 以来的数据。</template>
    </div>

    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="期号" prop="issueNo">
        <el-input v-model="queryParams.issueNo" placeholder="如 2026112" clearable style="width: 160px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="待开奖" value="0" />
          <el-option label="已开奖" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <template v-if="isHk">
        <el-col :span="1.5">
          <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['lottery:official:edit']">新增排期</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="info" plain icon="Upload" @click="importRef.open()" v-hasPermi="['lottery:official:import']">批量导入</el-button>
        </el-col>
      </template>
      <template v-else>
        <el-col :span="1.5">
          <el-button type="primary" plain icon="Refresh" :loading="syncing" @click="handleSyncLatest" v-hasPermi="['lottery:official:sync']">同步最新一期</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="warning" plain icon="Download" :loading="syncing" @click="handleSyncHistory" v-hasPermi="['lottery:official:sync']">同步历史</el-button>
        </el-col>
      </template>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="期号" align="center" prop="issueNo" width="100" />
      <el-table-column label="开奖时间" align="center" prop="drawTime" width="150">
        <template #default="scope">{{ (scope.row.drawTime || '').slice(0, 16) }}</template>
      </el-table-column>
      <el-table-column label="开奖号码" align="left" min-width="330">
        <template #default="scope">
          <div v-if="scope.row.status === '1'" class="draw-balls">
            <lottery-ball v-for="n in scope.row.normalNumbers.split(',')" :key="n" :number="n" :wave="waveOf(n)" />
            <span class="plus">+</span>
            <lottery-ball :number="scope.row.specialNumber" :wave="waveOf(scope.row.specialNumber)" selected size="large" />
          </div>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope">
          <el-tag v-if="scope.row.status === '1'" type="success" size="small">已开奖</el-tag>
          <el-tag v-else-if="isOverdue(scope.row)" type="danger" size="small">待录入</el-tag>
          <el-tag v-else type="info" size="small">待开奖</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" align="center" width="90">
        <template #default="scope">{{ sourceText[scope.row.source] || '—' }}</template>
      </el-table-column>
      <el-table-column label="视频" align="center" width="70">
        <template #default="scope">
          <el-link v-if="scope.row.videoUrl" type="primary" :href="scope.row.videoUrl" target="_blank" underline="never">查看</el-link>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="备注" align="left" prop="remark" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" align="center" width="220" class-name="small-padding fixed-width">
        <template #default="scope">
          <template v-if="isHk">
            <el-button link type="primary" icon="Edit" @click="handleNumbers(scope.row)" v-hasPermi="['lottery:official:edit']">{{ scope.row.status === '1' ? '改号码' : '录入号码' }}</el-button>
            <el-button link type="primary" icon="Setting" @click="handleUpdate(scope.row)" v-hasPermi="['lottery:official:edit']">修改</el-button>
            <el-button v-if="scope.row.status === '0'" link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['lottery:official:remove']">删除</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" icon="Refresh" @click="handleResync(scope.row)" v-hasPermi="['lottery:official:sync']">重新同步</el-button>
            <el-button link type="primary" icon="Setting" @click="handleUpdate(scope.row)" v-hasPermi="['lottery:official:edit']">视频/备注</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 新增排期 / 修改 -->
    <el-dialog :title="formTitle" v-model="formOpen" width="520px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <template v-if="isHk">
          <el-form-item label="期号" prop="issueNo">
            <el-input v-model="form.issueNo" placeholder="年份 + 3 位序号，如 2026112" maxlength="7" :disabled="!!form.drawId && form.status === '1'" />
          </el-form-item>
          <el-form-item label="开奖时间" prop="drawTime">
            <el-date-picker v-model="form.drawTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm" placeholder="如 2026-10-15 21:30" style="width: 100%" />
          </el-form-item>
        </template>
        <el-form-item v-else label="期号">
          <span>{{ form.issueNo }}（{{ (form.drawTime || '').slice(0, 16) }}）</span>
        </el-form-item>
        <el-form-item label="视频地址" prop="videoUrl">
          <el-input v-model="form.videoUrl" placeholder="mp4 或 m3u8 地址，可不填" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
          <el-button @click="formOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 录入号码（香港） -->
    <el-dialog :title="'第 ' + numbersForm.issueNo + ' 期开奖号码'" v-model="numbersOpen" width="640px" append-to-body>
      <div class="numbers-grid">
        <div v-for="(label, i) in numberLabels" :key="i" class="number-cell">
          <div class="number-label" :class="{ special: i === 6 }">{{ label }}</div>
          <el-select v-model="numbersForm.numbers[i]" filterable placeholder="号码" style="width: 76px">
            <el-option v-for="n in allNumbers" :key="n" :label="n" :value="n" :disabled="isPicked(n, i)" />
          </el-select>
        </div>
      </div>
      <div class="numbers-preview">
        <lottery-ball v-for="(n, i) in numbersForm.numbers.slice(0, 6)" :key="'n' + i" :number="n || '?'" :wave="n ? waveOf(n) : ''" />
        <span class="plus">+</span>
        <lottery-ball :number="numbersForm.numbers[6] || '?'" :wave="numbersForm.numbers[6] ? waveOf(numbersForm.numbers[6]) : ''" selected size="large" />
      </div>
      <div class="form-tip">按开出顺序选 6 个正码，最后一个为特码；7 个号码不能重复。保存后该期变为「已开奖」，到了开奖时间会在 H5 显示。</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitNumbers">保 存</el-button>
          <el-button @click="numbersOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <excel-import-dialog
      ref="importRef"
      title="批量导入香港六合彩"
      action="/lottery/official/importData"
      template-action="/lottery/official/importTemplate"
      template-file-name="hk_lottery"
      update-support-label="覆盖已开奖的同期号记录"
      @success="getList"
    />
  </div>
</template>

<script setup name="LotteryOfficial">
import LotteryBall from "../components/LotteryBall"
import ExcelImportDialog from "@/components/ExcelImportDialog"
import { getLotteryOptions } from "@/api/lottery/bet"
import {
  listOfficial, addOfficial, updateOfficial, saveOfficialNumbers, delOfficial,
  resyncOfficial, syncOfficialLatest, syncOfficialHistory
} from "@/api/lottery/official"

const { proxy } = getCurrentInstance()

const sourceText = { 1: "接口同步", 2: "手工录入", 3: "批量导入" }
const numberLabels = ["正码1", "正码2", "正码3", "正码4", "正码5", "正码6", "特码"]
const allNumbers = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, "0"))

const list = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const options = ref({ numbers: [] })
const syncing = ref(false)
const submitting = ref(false)
const importRef = ref(null)

const formOpen = ref(false)
const formTitle = ref("")
const numbersOpen = ref(false)
const numbersForm = ref({ drawId: null, issueNo: "", numbers: [] })

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    lotteryCode: "am",
    issueNo: undefined,
    status: undefined
  },
  form: {},
  formRules: {
    issueNo: [
      { required: true, message: "请填写期号", trigger: "blur" },
      { pattern: /^\d{4}\d{3}$/, message: "期号为 年份+3位序号，如 2026112", trigger: "blur" }
    ],
    drawTime: [{ required: true, message: "请选择开奖时间", trigger: "change" }]
  }
})

const { queryParams, form, formRules } = toRefs(data)
const isHk = computed(() => queryParams.value.lotteryCode === "hk")

function waveOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.wave : ""
}

/** 已过开奖时间但还没录入号码 */
function isOverdue(row) {
  return row.status === "0" && row.drawTime && new Date(row.drawTime.replace(" ", "T")) < new Date()
}

function isPicked(n, index) {
  return numbersForm.value.numbers.some((x, i) => i !== index && x === n)
}

function getList() {
  loading.value = true
  listOfficial(queryParams.value).then(res => {
    list.value = res.rows
    total.value = res.total
  }).finally(() => {
    loading.value = false
  })
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  proxy.resetForm("queryRef")
  handleQuery()
}

/** 下一期默认期号：最近一期 + 1 */
function nextIssue() {
  const latest = list.value.map(r => r.issueNo).sort().pop()
  const year = String(new Date().getFullYear())
  if (!latest || !latest.startsWith(year)) return year + "001"
  return year + String(Number(latest.slice(4)) + 1).padStart(3, "0")
}

function handleAdd() {
  form.value = { lotteryCode: "hk", issueNo: nextIssue(), drawTime: undefined, videoUrl: "", remark: "" }
  formTitle.value = "新增排期"
  proxy.resetForm("formRef")
  formOpen.value = true
}

function handleUpdate(row) {
  form.value = { ...row }
  formTitle.value = isHk.value ? "修改第 " + row.issueNo + " 期" : "第 " + row.issueNo + " 期视频 / 备注"
  formOpen.value = true
}

function submitForm() {
  proxy.$refs["formRef"].validate(valid => {
    if (!valid) return
    submitting.value = true
    const payload = { drawId: form.value.drawId, lotteryCode: queryParams.value.lotteryCode, issueNo: form.value.issueNo, drawTime: form.value.drawTime, videoUrl: form.value.videoUrl || "", remark: form.value.remark }
    const req = form.value.drawId ? updateOfficial(payload) : addOfficial(payload)
    req.then(() => {
      proxy.$modal.msgSuccess("保存成功")
      formOpen.value = false
      getList()
    }).finally(() => {
      submitting.value = false
    })
  })
}

function handleNumbers(row) {
  const numbers = row.status === "1" ? [...row.normalNumbers.split(","), row.specialNumber] : Array(7).fill(undefined)
  numbersForm.value = { drawId: row.drawId, issueNo: row.issueNo, numbers }
  numbersOpen.value = true
}

function submitNumbers() {
  const numbers = numbersForm.value.numbers
  if (numbers.length !== 7 || numbers.some(n => !n)) {
    proxy.$modal.msgError("请选齐 6 个正码和 1 个特码")
    return
  }
  const text = numbers.slice(0, 6).join(" ") + " + " + numbers[6]
  proxy.$modal.confirm(`确认第 ${numbersForm.value.issueNo} 期开奖号码为 ${text} 吗？`).then(() => {
    submitting.value = true
    return saveOfficialNumbers(numbersForm.value.drawId, numbers)
  }).then(() => {
    proxy.$modal.msgSuccess("已保存")
    numbersOpen.value = false
    getList()
  }).catch(() => {}).finally(() => {
    submitting.value = false
  })
}

function handleDelete(row) {
  proxy.$modal.confirm(`确认删除第 ${row.issueNo} 期排期吗？`).then(() => delOfficial(row.drawId)).then(() => {
    proxy.$modal.msgSuccess("删除成功")
    getList()
  }).catch(() => {})
}

function handleResync(row) {
  proxy.$modal.confirm(`按接口重新获取第 ${row.issueNo} 期号码并覆盖吗？`).then(() => {
    proxy.$modal.loading("正在同步…")
    return resyncOfficial(row.drawId)
  }).then(() => {
    proxy.$modal.msgSuccess("已重新同步")
    getList()
  }).catch(() => {}).finally(() => {
    proxy.$modal.closeLoading()
  })
}

function handleSyncLatest() {
  syncing.value = true
  syncOfficialLatest().then(res => {
    proxy.$modal.msgSuccess(res.msg || "完成")
    getList()
  }).finally(() => {
    syncing.value = false
  })
}

function handleSyncHistory() {
  proxy.$prompt("从哪一天开始补（只补缺失的期）", "同步历史", {
    inputValue: "2025-01-01",
    inputPattern: /^\d{4}-\d{2}-\d{2}$/,
    inputErrorMessage: "日期格式为 2025-01-01"
  }).then(({ value }) => {
    syncing.value = true
    return syncOfficialHistory(value)
  }).then(res => {
    proxy.$modal.msgSuccess(res.msg || "完成")
    getList()
  }).catch(() => {}).finally(() => {
    syncing.value = false
  })
}

onMounted(() => {
  getLotteryOptions().then(res => {
    options.value = res.data
  }).finally(() => getList())
})
</script>

<style scoped>
.lottery-tip {
  margin: 4px 0 12px;
  font-size: 12px;
  color: #909399;
  line-height: 20px;
}
.draw-balls,
.numbers-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.numbers-preview {
  margin: 16px 0 8px;
}
.plus {
  margin: 0 6px;
  color: #909399;
  font-weight: 600;
}
.muted {
  color: #c0c4cc;
}
.numbers-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}
.number-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.number-label {
  font-size: 12px;
  color: #606266;
}
.number-label.special {
  color: #e6a23c;
  font-weight: 600;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 20px;
}
</style>
