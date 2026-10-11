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
    <el-dialog title="开奖" v-model="open" width="520px" append-to-body>
      <el-form ref="drawRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="期号" prop="issueNo">
          <el-date-picker v-model="form.issueNo" type="date" value-format="YYYYMMDD" format="YYYY-MM-DD" :clearable="false" style="width: 180px" @change="loadSummary" />
        </el-form-item>
        <el-form-item label="本期投注">
          <span v-if="summary">{{ summary.betCount }} 笔，总投注 {{ formatMoney(summary.totalAmount) }} 元</span>
          <el-tag v-if="summary && summary.drawn" type="warning" size="small" class="ml10">该期已开奖</el-tag>
        </el-form-item>
        <el-form-item label="赔付比例" prop="ratio">
          <el-radio-group v-model="form.ratio">
            <el-radio-button v-for="r in options.ratios" :key="r" :value="r">{{ r }}%</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <div class="form-tip">
            在「赔付 ≤ 总投注 × 比例」的号码中随机开出特码，6 个正码从其余号码随机选取；没有满足的号码时开出赔付最少的号码并标记超限。每期只能开一次。
          </div>
        </el-form-item>
      </el-form>

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
import { listDraw, drawLottery } from "@/api/lottery/draw"

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
  if (!form.value.issueNo) return
  getIssueSummary(form.value.issueNo).then(res => {
    summary.value = res.data
  })
}

/** 开奖按钮操作 */
function handleDraw() {
  form.value = { issueNo: today(), ratio: undefined }
  result.value = null
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
