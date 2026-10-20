<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="开奖日期" style="width: 308px">
        <el-date-picker v-model="dateRange" value-format="YYYY-MM-DD" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期"></el-date-picker>
      </el-form-item>
      <el-form-item label="特码" prop="specialNumber">
        <el-select v-model="queryParams.specialNumber" placeholder="全部" clearable filterable style="width: 120px">
          <el-option v-for="n in options.numbers" :key="n.number" :label="n.number + ' ' + n.zodiac" :value="n.number" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="MagicStick" @click="handleDraw" v-hasPermi="['lottery:draw:add']">开奖</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="drawList">
      <el-table-column label="期号" align="center" prop="issueNo" width="100" />
      <el-table-column label="开奖号码" align="left" min-width="330">
        <template #default="scope">
          <div class="draw-balls">
            <lottery-ball v-for="n in scope.row.normalNumbers.split(',')" :key="n" :number="n" :wave="waveOf(n)" :title="zodiacOf(n)" />
            <span class="plus">+</span>
            <lottery-ball :number="scope.row.specialNumber" :wave="waveOf(scope.row.specialNumber)" :title="zodiacOf(scope.row.specialNumber)" selected size="large" />
          </div>
        </template>
      </el-table-column>
      <el-table-column label="特码生肖/色波" align="center" width="120">
        <template #default="scope">{{ zodiacOf(scope.row.specialNumber) }} / {{ waveOf(scope.row.specialNumber) }}</template>
      </el-table-column>
      <!--
      <el-table-column label="总投注" align="right" prop="totalAmount" width="110">
        <template #default="scope">{{ formatMoney(scope.row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column label="赔付" align="right" prop="payout" width="110">
        <template #default="scope">{{ formatMoney(scope.row.payout) }}</template>
      </el-table-column>
      <el-table-column label="赔付占比" align="center" prop="payoutRatio" width="100">
        <template #default="scope">{{ ratioText(scope.row.payoutRatio) }}</template>
      </el-table-column>
      -->
      <el-table-column label="操作人" align="center" prop="createBy" width="100" />
      <el-table-column label="开奖时间" align="center" prop="createTime" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 开奖 -->
    <el-dialog title="开奖" v-model="open" width="640px" append-to-body>
      <el-form ref="drawRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="开奖日期" prop="issueNo">
          <el-date-picker v-model="form.issueNo" type="date" value-format="YYYYMMDD" format="YYYY-MM-DD" :clearable="false" style="width: 180px" @change="handleDateChange" />
          <span class="issue-tip">第 <span style="color: #ec1414;">{{ issueOf(form.issueNo) }}</span> 期</span>
        </el-form-item>
      </el-form>

      <!-- 号码赔付参考：每个号码作为特码时本期要赔多少 -->
      <div class="numbers-grid">
        <div v-for="(label, i) in numberLabels" :key="i" class="number-cell">
          <div class="number-label" :class="{ special: i === 6 }">{{ label }}</div>
          <el-select v-model="numbersForm.numbers[i]" filterable placeholder="号码" style="width: 76px">
            <el-option v-for="n in allNumbers" :key="n" :label="n" :value="n" :disabled="isPicked(n, i)" />
          </el-select>
        </div>
      </div>
      <div class="numbers-preview">
        <lottery-ball v-for="i in 6" :key="'n' + i" :number="numbersForm.numbers[i - 1] || '?'" :wave="numbersForm.numbers[i - 1] ? waveOf(numbersForm.numbers[i - 1]) : ''" />
        <span class="plus">+</span>
        <lottery-ball :number="numbersForm.numbers[6] || '?'" :wave="numbersForm.numbers[6] ? waveOf(numbersForm.numbers[6]) : ''" selected size="large" />
      </div>
      <div class="form-tip">按开出顺序选 6 个正码，最后一个为特码；7 个号码不能重复。保存后该期变为「已开奖」，到了开奖时间会在 H5 显示。</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitNumbers">保 存</el-button>
          <el-button @click="open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="LotteryDraw">
import LotteryBall from "../components/LotteryBall"
import { issueOf, todayDate } from "@/utils/lotteryIssue"
import { getLotteryOptions, getIssueSummary } from "@/api/lottery/bet"
import { listDraw, saveDrawNumbers, previewDraw } from "@/api/lottery/draw"

const { proxy } = getCurrentInstance()

const drawList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const dateRange = ref([])
const options = ref({ zodiacs: [], numbers: [], waves: [] })
const open = ref(false)
const submitting = ref(false)
const summary = ref(null)
const result = ref(null)
const preview = ref(null)
const previewLoading = ref(false)
const numberLabels = ["正码1", "正码2", "正码3", "正码4", "正码5", "正码6", "特码"]
const allNumbers = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, "0"))
const numbersForm = ref({ drawId: null, issueNo: "", numbers: [] })

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    specialNumber: undefined
  },
  form: {},
  rules: {
    issueNo: [{ required: true, message: "请选择开奖日期", trigger: "change" }]
  }
})

const { queryParams, form, rules } = toRefs(data)

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "—"
  return Number(v).toFixed(2)
}

function ratioText(v) {
  return v === null || v === undefined ? "—" : v + "%"
}

function waveOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.wave : ""
}

function zodiacOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.zodiac : ""
}

function isPicked(n, index) {
  return numbersForm.value.numbers.some((x, i) => i !== index && x === n)
}

/** 查询开奖记录 */
function getList() {
  loading.value = true
  listDraw(proxy.addDateRange(queryParams.value, dateRange.value)).then(res => {
    loading.value = false
    drawList.value = res.rows
    total.value = res.total
  }).catch(() => {
    loading.value = false
  })
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  proxy.resetForm("queryRef")
  handleQuery()
}

/** 重新选择日期：清空已选号码并重新加载本期汇总 */
function handleDateChange() {
  numbersForm.value.numbers = []
  loadSummary()
}

/** 加载本期汇总；未开奖时再加载赔付参考 */
function loadSummary() {
  summary.value = null
  preview.value = null
  if (!form.value.issueNo) return
  const issueNo = form.value.issueNo
  getIssueSummary(issueNo).then(res => {
    summary.value = res.data
    if (!res.data.drawn) loadPreview(issueNo)
  })
}

function loadPreview(issueNo) {
  previewLoading.value = true
  previewDraw(issueNo).then(res => {
    // 日期已改变时丢弃过期结果
    if (form.value.issueNo === issueNo) {
      preview.value = res.data
    }
  }).finally(() => {
    previewLoading.value = false
  })
}

/** 开奖按钮操作 */
function handleDraw() {
  form.value = { issueNo: todayDate() }
  result.value = null
  preview.value = null
  proxy.resetForm("drawRef")
  open.value = true
  loadSummary()
}

function submitNumbers() {
  const numbers = numbersForm.value.numbers
  if (numbers.length !== 7 || numbers.some(n => !n)) {
    proxy.$modal.msgError("请选齐 6 个正码和 1 个特码")
    return
  }
  const text = numbers.slice(0, 6).join(" ") + " + " + numbers[6]
  proxy.$modal.confirm(`确认第 ${issueOf(form.value.issueNo)} 期开奖号码为 ${text} 吗？`).then(() => {
    submitting.value = true
    return saveDrawNumbers(form.value.issueNo, numbers)
  }).then(() => {+
    proxy.$modal.msgSuccess("已保存")
    open.value = false
    getList()
  }).catch(() => {}).finally(() => {
    submitting.value = false
  })
}

onMounted(() => {
  getLotteryOptions().then(res => {
    options.value = res.data
  }).finally(() => getList())
})
</script>

<style scoped>
.ml10 {
  margin-left: 10px;
}
.draw-balls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.plus {
  margin: 0 6px;
  color: #909399;
  font-weight: 600;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 20px;
}
.preview {
  margin: 0 20px 12px;
}
.preview-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  margin-bottom: 8px;
}
.preview-title {
  font-weight: 600;
  margin-right: 8px;
}
.sep {
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
.draw-balls,
.numbers-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.numbers-preview {
  margin: 16px 0 8px;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.preview-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  font-size: 12px;
  line-height: 15px;
}
.preview-cell.zero {
  color: #a8abb2;
}
.preview-cell.special {
  border: 2px solid #e6a23c;
}
.cell-text {
  min-width: 0;
}
.cell-payout {
  font-weight: 600;
  white-space: nowrap;
}
.cell-ratio {
  font-size: 11px;
  opacity: 0.8;
}
.preview-legend {
  display: flex;
  gap: 16px;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
.legend {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 2px;
  border: 1px solid var(--el-border-color);
  vertical-align: -1px;
}
.legend.special {
  border: 2px solid #e6a23c;
}
.result {
  margin: 0 20px;
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.result-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.result-line {
  margin-top: 8px;
  font-size: 13px;
}
.issue-tip {
  margin-left: 10px;
  color: #686767;
}
</style>
