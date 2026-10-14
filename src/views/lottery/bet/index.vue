<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="期号" prop="issueNo">
        <el-date-picker v-model="queryParams.issueNo" type="date" value-format="YYYYMMDD" format="YYYY-MM-DD" placeholder="全部期号" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="投注方式" prop="betType">
        <el-select v-model="queryParams.betType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="t in betTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="summary" :type="summary.drawn ? 'warning' : 'info'" :closable="false" class="mb8">
      <template #title>
        第 {{ summary.issueNo }} 期：共 {{ summary.betCount }} 笔，总投注 {{ formatMoney(summary.totalAmount) }} 元
        <el-tag v-if="summary.drawn" type="warning" size="small" class="ml10">已开奖，投注已锁定</el-tag>
        <el-tag v-else type="success" size="small" class="ml10">未开奖</el-tag>
      </template>
    </el-alert>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['lottery:bet:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="!canDeleteSelection" @click="handleDelete()" v-hasPermi="['lottery:bet:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="betList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" :selectable="row => !row.drawn" />
      <el-table-column label="期号" align="center" prop="issueNo" width="100" />
      <el-table-column label="投注方式" align="center" width="90">
        <template #default="scope">
          <el-tag :type="betTypeTag(scope.row.betType)" size="small">{{ betTypeLabel(scope.row.betType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="投注项" align="center" width="90">
        <template #default="scope">
          <lottery-ball v-if="scope.row.betType === '2'" :number="scope.row.betItem" :wave="waveOf(scope.row.betItem)" />
          <span v-else>{{ scope.row.betItem }}</span>
        </template>
      </el-table-column>
      <el-table-column label="号码" align="left" min-width="220">
        <template #default="scope">
          <template v-if="scope.row.betType !== '2' && scope.row.numbers">
            <lottery-ball v-for="n in scope.row.numbers.split(',')" :key="n" :number="n" :wave="waveOf(n)" size="small" />
          </template>
        </template>
      </el-table-column>
      <el-table-column label="金额" align="right" prop="amount" width="100">
        <template #default="scope">{{ formatMoney(scope.row.amount) }}</template>
      </el-table-column>
      <el-table-column label="每号金额" align="right" prop="perAmount" width="100">
        <template #default="scope">{{ formatMoney(scope.row.perAmount) }}</template>
      </el-table-column>
      <el-table-column label="中奖赔付" align="right" prop="winPayout" width="110">
        <template #default="scope">{{ formatMoney(scope.row.winPayout) }}</template>
      </el-table-column>
      <el-table-column label="备注" align="center" prop="remark" :show-overflow-tooltip="true" />
      <el-table-column label="录入人" align="center" prop="createBy" width="100" />
      <el-table-column label="录入时间" align="center" prop="createTime" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tag v-if="scope.row.drawn" type="info" size="small">已开奖</el-tag>
          <template v-else>
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['lottery:bet:edit']">修改</el-button>
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['lottery:bet:remove']">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 新增/修改投注 -->
    <el-dialog :title="title" v-model="open" width="720px" append-to-body>
      <el-form ref="betRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="期号" prop="issueNo">
          <el-date-picker v-model="form.issueNo" type="date" value-format="YYYYMMDD" format="YYYY-MM-DD" :disabled="isEdit" :clearable="false" style="width: 180px" />
          <span v-if="issueDayOfYear !== null" class="ml10">{{ issueDayOfYear }} 期</span>
        </el-form-item>
        <el-form-item label="投注方式" prop="betType">
          <el-radio-group v-model="form.betType" @change="form.betItems = []">
            <el-radio-button v-for="t in betTypes" :key="t.value" :value="t.value">{{ t.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="投注项" prop="betItems">
          <div v-if="form.betType === '1'" class="item-grid">
            <el-check-tag v-for="z in options.zodiacs" :key="z.name" :checked="isPicked(z.name)" @change="togglePick(z.name)" class="item-tag">
              {{ z.name }}<span class="item-sub">{{ z.numbers.length }}个号</span>
            </el-check-tag>
          </div>
          <div v-else-if="form.betType === '2'" class="ball-grid">
            <lottery-ball
              v-for="n in options.numbers"
              :key="n.number"
              :number="n.number"
              :wave="n.wave"
              :title="n.zodiac + ' · ' + n.wave"
              :selected="isPicked(n.number)"
              clickable
              size="large"
              @click="togglePick(n.number)"
            />
          </div>
          <div v-else-if="form.betType === '3'" class="item-grid">
            <el-check-tag v-for="w in options.waves" :key="w.name" :checked="isPicked(w.name)" @change="togglePick(w.name)" class="item-tag">
              {{ w.name }}<span class="item-sub">{{ w.numbers.length }}个号 · 赔率 {{ w.odds }}</span>
            </el-check-tag>
          </div>
          <div class="form-tip">{{ isEdit ? '修改时只能选一个投注项' : '可多选，每个投注项各生成一条投注，金额相同' }}</div>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="10" controls-position="right" style="width: 180px" />
          <span class="ml10">元 / 每个投注项</span>
        </el-form-item>
        <el-form-item v-if="preview.length" label="核对">
          <div class="preview">
            <div v-for="p in preview" :key="p.item" :class="{ 'preview-error': !p.ok }">
              {{ p.item }}：{{ p.count }} 个号，
              <template v-if="p.ok">每号 {{ formatMoney(p.per) }} 元</template>
              <template v-else>{{ formatMoney(form.amount) }} 元不能均分到每个号码</template>
            </div>
            <div v-if="!isEdit && preview.length > 1" class="preview-total">合计 {{ preview.length }} 笔，{{ formatMoney(form.amount * preview.length) }} 元</div>
          </div>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="选填" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
          <el-button @click="open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="LotteryBet">
import LotteryBall from "../components/LotteryBall"
import { getLotteryOptions, listBet, getIssueSummary, addBet, updateBet, delBet } from "@/api/lottery/bet"

const { proxy } = getCurrentInstance()

const betTypes = [
  { value: "1", label: "生肖" },
  { value: "2", label: "号码" },
  { value: "3", label: "色波" }
]

const betList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const selection = ref([])
const summary = ref(null)
const open = ref(false)
const title = ref("")
const isEdit = ref(false)
const submitting = ref(false)
const options = ref({ zodiacs: [], numbers: [], waves: [] })

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 20,
    issueNo: today(),
    betType: undefined
  },
  form: {},
  rules: {
    issueNo: [{ required: true, message: "请选择期号", trigger: "change" }],
    betType: [{ required: true, message: "请选择投注方式", trigger: "change" }],
    betItems: [{ type: "array", required: true, min: 1, message: "请选择投注项", trigger: "change" }],
    amount: [{ required: true, message: "请输入金额", trigger: "blur" }]
  }
})

const { queryParams, form, rules } = toRefs(data)

const canDeleteSelection = computed(() => selection.value.length > 0 && selection.value.every(r => !r.drawn))

/** issueNo 距当年 1 月 1 日的天数 */
const issueDayOfYear = computed(() => {
  const s = String(form.value.issueNo || "")
  if (!/^\d{8}$/.test(s)) return null
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  if (isNaN(d.getTime())) return null
  return Math.round((d - new Date(d.getFullYear(), 0, 1)) / 86400000)
})

/** 每个已选投注项的号码数与每号金额（金额以分计算，避免浮点误差） */
const preview = computed(() => {
  const cents = Math.round((form.value.amount || 0) * 100)
  if (!cents || !form.value.betItems) return []
  return form.value.betItems.map(item => {
    const count = numbersOf(form.value.betType, item).length
    const ok = count > 0 && cents % count === 0
    return { item, count, ok, per: ok ? cents / count / 100 : 0 }
  })
})

function today() {
  const d = new Date()
  const p = n => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "—"
  return Number(v).toFixed(2)
}

function betTypeLabel(type) {
  const t = betTypes.find(b => b.value === type)
  return t ? t.label : type
}

function betTypeTag(type) {
  return { "1": "warning", "2": "primary", "3": "success" }[type] || "info"
}

function waveOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.wave : ""
}

function numbersOf(betType, item) {
  if (betType === "1") {
    const z = options.value.zodiacs.find(x => x.name === item)
    return z ? z.numbers : []
  }
  if (betType === "2") {
    return options.value.numbers.some(x => x.number === item) ? [item] : []
  }
  const w = options.value.waves.find(x => x.name === item)
  return w ? w.numbers : []
}

function isPicked(item) {
  return (form.value.betItems || []).includes(item)
}

function togglePick(item) {
  const items = form.value.betItems || []
  if (isEdit.value) {
    form.value.betItems = [item]
  } else if (items.includes(item)) {
    form.value.betItems = items.filter(x => x !== item)
  } else {
    form.value.betItems = [...items, item]
  }
  proxy.$refs["betRef"]?.validateField("betItems").catch(() => {})
}

function loadOptions() {
  return getLotteryOptions().then(res => {
    options.value = res.data
  })
}

/** 查询投注列表 */
function getList() {
  loading.value = true
  listBet(queryParams.value).then(res => {
    loading.value = false
    betList.value = res.rows
    total.value = res.total
  }).catch(() => {
    loading.value = false
  })
  loadSummary()
}

function loadSummary() {
  const issueNo = queryParams.value.issueNo
  if (!issueNo) {
    summary.value = null
    return
  }
  getIssueSummary(issueNo).then(res => {
    summary.value = res.data
  })
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef")
  queryParams.value.issueNo = today()
  handleQuery()
}

function handleSelectionChange(rows) {
  selection.value = rows
}

function reset(betType = "1") {
  form.value = {
    betId: undefined,
    issueNo: queryParams.value.issueNo || today(),
    betType,
    betItems: [],
    amount: undefined,
    remark: undefined
  }
  proxy.resetForm("betRef")
}

/** 新增按钮操作 */
function handleAdd() {
  isEdit.value = false
  reset()
  title.value = "新增投注"
  open.value = true
}

/** 修改按钮操作 */
function handleUpdate(row) {
  isEdit.value = true
  reset(row.betType)
  form.value = {
    betId: row.betId,
    issueNo: row.issueNo,
    betType: row.betType,
    betItems: [row.betItem],
    amount: Number(row.amount),
    remark: row.remark
  }
  title.value = "修改投注"
  open.value = true
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["betRef"].validate(valid => {
    if (!valid) return
    const bad = preview.value.find(p => !p.ok)
    if (bad) {
      proxy.$modal.msgError(`「${bad.item}」有 ${bad.count} 个号码，金额不能均分到每个号码`)
      return
    }
    submitting.value = true
    const done = msg => {
      proxy.$modal.msgSuccess(msg)
      open.value = false
      getList()
    }
    const req = isEdit.value
      ? updateBet({ betId: form.value.betId, betType: form.value.betType, betItem: form.value.betItems[0], amount: form.value.amount, remark: form.value.remark }).then(() => done("修改成功"))
      : addBet(form.value).then(() => done(`新增 ${form.value.betItems.length} 笔投注`))
    req.finally(() => {
      submitting.value = false
    })
  })
}

/** 删除按钮操作 */
function handleDelete(row) {
  const rows = row ? [row] : selection.value
  const ids = rows.map(r => r.betId)
  proxy.$modal.confirm(`确认删除选中的 ${ids.length} 笔投注吗？`).then(function () {
    return delBet(ids.join(","))
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {})
}

onMounted(() => {
  loadOptions().finally(() => getList())
})
</script>

<style scoped>
.ml10 {
  margin-left: 10px;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.item-tag {
  min-width: 64px;
  text-align: center;
}
.item-sub {
  margin-left: 6px;
  font-size: 12px;
  font-weight: normal;
  opacity: 0.75;
}
.ball-grid {
  display: grid;
  grid-template-columns: repeat(10, 38px);
  gap: 2px;
}
.form-tip {
  width: 100%;
  font-size: 12px;
  color: #909399;
  line-height: 20px;
  margin-top: 4px;
}
.preview {
  line-height: 22px;
  font-size: 13px;
}
.preview-error {
  color: #e5484d;
}
.preview-total {
  margin-top: 4px;
  font-weight: 600;
}
</style>
