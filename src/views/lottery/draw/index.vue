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
      <el-form-item label="是否超限" prop="overLimit">
        <el-select v-model="queryParams.overLimit" placeholder="全部" clearable style="width: 120px">
          <el-option label="否" value="0" />
          <el-option label="是" value="1" />
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

    <el-table v-loading="loading" :data="drawList" :row-class-name="rowClassName">
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
      <el-table-column label="所选比例" align="center" prop="ratio" width="90">
        <template #default="scope">{{ scope.row.ratio }}%</template>
      </el-table-column>
      <el-table-column label="总投注" align="right" prop="totalAmount" width="110">
        <template #default="scope">{{ formatMoney(scope.row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column label="赔付" align="right" prop="payout" width="110">
        <template #default="scope">{{ formatMoney(scope.row.payout) }}</template>
      </el-table-column>
      <el-table-column label="实际比例" align="center" prop="payoutRatio" width="100">
        <template #default="scope">
          <span :class="{ 'text-danger': scope.row.overLimit === '1' }">{{ scope.row.payoutRatio === null || scope.row.payoutRatio === undefined ? '—' : scope.row.payoutRatio + '%' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="超限" align="center" width="80">
        <template #default="scope">
          <el-tag v-if="scope.row.overLimit === '1'" type="danger" size="small">超限</el-tag>
          <span v-else>否</span>
        </template>
      </el-table-column>
      <el-table-column label="操作人" align="center" prop="createBy" width="100" />
      <el-table-column label="开奖时间" align="center" prop="createTime" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 开奖 -->
    <el-dialog title="开奖" v-model="open" width="860px" append-to-body>
      <el-form ref="drawRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="期号" prop="issueNo">
          <el-date-picker v-model="form.issueNo" type="date" value-format="YYYYMMDD" format="YYYY-MM-DD" :clearable="false" style="width: 180px" @change="loadSummary" />
        </el-form-item>
        <el-form-item label="本期投注">
          <span v-if="summary">{{ summary.betCount }} 笔，总投注 {{ formatMoney(summary.totalAmount) }} 元</span>
          <el-tag v-if="summary && summary.drawn" type="warning" size="small" class="ml10">该期已开奖</el-tag>
        </el-form-item>
        <el-form-item label="赔付比例" prop="ratio">
          <el-radio-group v-model="form.ratio" @change="loadPreview">
            <el-radio-button v-for="r in options.ratios" :key="r" :value="r">{{ r }}%</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <div class="form-tip">
            在「赔付 ≤ 总投注 × 比例」的号码中开出赔付最接近上限的号码作为特码（并列时随机），6 个正码从其余号码随机选取；没有满足的号码时开出赔付最少的号码并标记超限。每期只能开一次。
          </div>
        </el-form-item>
      </el-form>

      <!-- 号码赔付预览 -->
      <div v-if="preview" v-loading="previewLoading" class="preview">
        <div class="preview-head">
          <span class="preview-title">号码赔付预览</span>
          <span>上限 {{ formatMoney(preview.limit) }} 元</span>
          <span class="sep">·</span>
          <span>满足上限 {{ withinCount }} 个号码</span>
          <span class="sep">·</span>
          <template v-if="!preview.overLimit">
            <span>候选 {{ candidateRows.length }} 个，赔付 {{ formatMoney(candidateRows[0]?.payout) }} 元（{{ ratioText(candidateRows[0]?.payoutRatio) }}）</span>
          </template>
          <el-tag v-else type="danger" size="small">没有号码满足上限，将开出赔付最少的号码（{{ formatMoney(candidateRows[0]?.payout) }} 元）</el-tag>
        </div>
        <div class="preview-grid">
          <div
            v-for="row in preview.rows"
            :key="row.number"
            class="preview-cell"
            :class="{ candidate: row.candidate, over: !row.withinLimit, special: result && result.specialNumber === row.number }"
            :title="zodiacOf(row.number) + ' / ' + waveOf(row.number)"
          >
            <lottery-ball :number="row.number" :wave="waveOf(row.number)" size="small" />
            <div class="cell-text">
              <div class="cell-payout">{{ formatPayout(row.payout) }}</div>
              <div class="cell-ratio">{{ ratioText(row.payoutRatio) }}</div>
            </div>
          </div>
        </div>
        <div class="preview-legend">
          <span><i class="legend candidate"></i>候选（特码从中随机开出）</span>
          <span><i class="legend within"></i>满足上限</span>
          <span><i class="legend over"></i>超过上限</span>
          <span v-if="result"><i class="legend special"></i>本期特码</span>
        </div>
      </div>

      <div v-if="result" class="result">
        <div class="result-title">第 {{ result.issueNo }} 期开奖结果</div>
        <div class="draw-balls">
          <lottery-ball v-for="n in result.normalNumbers.split(',')" :key="n" :number="n" :wave="waveOf(n)" size="large" />
          <span class="plus">+</span>
          <lottery-ball :number="result.specialNumber" :wave="waveOf(result.specialNumber)" selected size="large" />
        </div>
        <div class="result-line">
          特码 {{ result.specialNumber }}（{{ zodiacOf(result.specialNumber) }} / {{ waveOf(result.specialNumber) }}），
          赔付 {{ formatMoney(result.payout) }} 元，实际比例 {{ result.payoutRatio === null || result.payoutRatio === undefined ? '—' : result.payoutRatio + '%' }}
          <el-tag v-if="result.overLimit === '1'" type="danger" size="small" class="ml10">超限</el-tag>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="!result" type="primary" :loading="submitting" :disabled="!summary || summary.drawn" @click="submitDraw">开 奖</el-button>
          <el-button @click="open = false">{{ result ? '关 闭' : '取 消' }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="LotteryDraw">
import LotteryBall from "../components/LotteryBall"
import { getLotteryOptions, getIssueSummary } from "@/api/lottery/bet"
import { listDraw, drawLottery, previewDraw } from "@/api/lottery/draw"

const { proxy } = getCurrentInstance()

const drawList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const dateRange = ref([])
const options = ref({ zodiacs: [], numbers: [], waves: [], ratios: [10, 20, 30, 50] })
const open = ref(false)
const submitting = ref(false)
const summary = ref(null)
const result = ref(null)
const preview = ref(null)
const previewLoading = ref(false)

const candidateRows = computed(() => (preview.value ? preview.value.rows.filter(r => r.candidate) : []))
const withinCount = computed(() => (preview.value ? preview.value.rows.filter(r => r.withinLimit).length : 0))

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    specialNumber: undefined,
    overLimit: undefined
  },
  form: {},
  rules: {
    issueNo: [{ required: true, message: "请选择期号", trigger: "change" }],
    ratio: [{ required: true, message: "请选择赔付比例", trigger: "change" }]
  }
})

const { queryParams, form, rules } = toRefs(data)

function today() {
  const d = new Date()
  const p = n => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "—"
  return Number(v).toFixed(2)
}

function ratioText(v) {
  return v === null || v === undefined ? "—" : v + "%"
}

/** 预览格子里的金额：去掉多余的 .00，过大时用「万」 */
function formatPayout(v) {
  const n = Number(v || 0)
  if (n >= 100000) return (n / 10000).toFixed(1) + "万"
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function waveOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.wave : ""
}

function zodiacOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.zodiac : ""
}

function rowClassName({ row }) {
  return row.overLimit === "1" ? "over-limit-row" : ""
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

function loadSummary() {
  summary.value = null
  preview.value = null
  if (!form.value.issueNo) return
  getIssueSummary(form.value.issueNo).then(res => {
    summary.value = res.data
    loadPreview()
  })
}

/** 未开奖且已选比例时加载号码赔付预览 */
function loadPreview() {
  if (!summary.value || summary.value.drawn || !form.value.ratio || result.value) {
    if (!result.value) preview.value = null
    return
  }
  const { issueNo, ratio } = form.value
  previewLoading.value = true
  previewDraw(issueNo, ratio).then(res => {
    // 期号或比例已改变时丢弃过期结果
    if (form.value.issueNo === issueNo && form.value.ratio === ratio) {
      preview.value = res.data
    }
  }).finally(() => {
    previewLoading.value = false
  })
}

/** 开奖按钮操作 */
function handleDraw() {
  form.value = { issueNo: today(), ratio: options.value.ratios[0] }
  result.value = null
  preview.value = null
  proxy.resetForm("drawRef")
  open.value = true
  loadSummary()
}

function submitDraw() {
  proxy.$refs["drawRef"].validate(valid => {
    if (!valid) return
    proxy.$modal.confirm(`确认按 ${form.value.ratio}% 的赔付比例开出第 ${form.value.issueNo} 期吗？开奖后该期投注将锁定，且不能重开。`).then(() => {
      submitting.value = true
      return drawLottery(form.value.issueNo, form.value.ratio)
    }).then(res => {
      result.value = res.data
      getList()
    }).catch(() => {}).finally(() => {
      submitting.value = false
    })
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
.preview-cell.over {
  background: var(--el-fill-color-light);
  color: #a8abb2;
}
.preview-cell.candidate {
  border-color: #2f9e44;
  background: rgba(47, 158, 68, 0.08);
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
.legend.candidate {
  border-color: #2f9e44;
  background: rgba(47, 158, 68, 0.25);
}
.legend.over {
  background: var(--el-fill-color-dark);
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
.text-danger {
  color: #e5484d;
  font-weight: 600;
}
:deep(.over-limit-row) {
  --el-table-tr-bg-color: #fff1f0;
}
</style>
