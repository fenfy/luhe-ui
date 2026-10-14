<template>
  <div class="app-container">
    <el-form :inline="true" label-width="68px">
      <el-form-item label="统计对象">
        <el-radio-group v-model="type" @change="load">
          <el-radio-button value="special">特码</el-radio-button>
          <el-radio-button value="normal">正码</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="期数">
        <el-select v-model="periods" style="width: 120px" @change="load">
          <el-option v-for="p in PERIODS" :key="p" :label="'最近 ' + p + ' 期'" :value="p" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button icon="Refresh" @click="load">刷新</el-button>
      </el-form-item>
    </el-form>

    <div v-loading="loading">
      <el-alert v-if="trend" :closable="false" type="info" class="mb8">
        <template #title>
          <span v-if="trend.periods">统计第 {{ trend.fromIssue }} 期 ～ 第 {{ trend.toIssue }} 期，共 {{ trend.periods }} 期<template v-if="trend.periods < periods">（开奖不足 {{ periods }} 期）</template>，{{ isSpecial ? '每期 1 个特码' : '每期 6 个正码' }}，共开出 {{ trend.hits }} 个号码。</span>
          <span v-else>暂无开奖记录。</span>
          <span class="muted">生肖按当前年份的对应关系统计。</span>
        </template>
      </el-alert>

      <template v-if="trend && trend.periods">
        <!-- 号码 -->
        <el-card shadow="never" class="mb8">
          <template #header>
            <span class="card-title">号码出现次数</span>
            <span class="muted">{{ isSpecial ? '格子下方为次数 / 当前遗漏期数，「—」表示近 100 期内未开出' : '格子下方为出现次数' }}</span>
          </template>
          <div class="number-grid">
            <div v-for="item in trend.numbers" :key="item.key" class="number-cell" :class="{ hot: item.count === maxNumberCount && item.count > 0 }">
              <lottery-ball :number="item.key" :wave="waveOf(item.key)" :title="zodiacOf(item.key) + ' / ' + waveOf(item.key)" />
              <div class="cell-count">{{ item.count }}<template v-if="isSpecial"> / {{ missText(item.miss) }}</template></div>
            </div>
          </div>
        </el-card>

        <el-row :gutter="12">
          <el-col v-for="sec in sections" :key="sec.key" :xs="24" :md="12" class="mb8">
            <el-card shadow="never">
              <template #header>
                <span class="card-title">{{ sec.title }}</span>
              </template>
              <trend-bar :items="trend[sec.key]" :hits="trend.hits" :color-of="sec.colorOf" :show-miss="isSpecial" />
              <el-table :data="trend[sec.key]" size="small" class="mt8">
                <el-table-column :label="sec.title.replace('统计', '')" prop="key" align="center" />
                <el-table-column label="次数" prop="count" align="center" />
                <el-table-column label="占比" align="center">
                  <template #default="scope">{{ percent(scope.row.count) }}</template>
                </el-table-column>
                <el-table-column v-if="isSpecial" label="当前遗漏" align="center">
                  <template #default="scope">{{ missText(scope.row.miss) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </template>
    </div>
  </div>
</template>

<script setup name="LotteryTrend">
import LotteryBall from "../components/LotteryBall"
import TrendBar from "../components/TrendBar"
import { getLotteryOptions } from "@/api/lottery/bet"
import { getTrend } from "@/api/lottery/trend"

const PERIODS = [10, 20, 30, 50, 100]
const WAVE_COLORS = { 红: "#e5484d", 蓝: "#3e7bfa", 绿: "#2f9e44" }

const type = ref("special")
const periods = ref(30)
const loading = ref(false)
const trend = ref(null)
const options = ref({ zodiacs: [], numbers: [], waves: [] })

const isSpecial = computed(() => trend.value && trend.value.type === "special")
const maxNumberCount = computed(() => (trend.value ? Math.max(0, ...trend.value.numbers.map(i => i.count)) : 0))

function waveColor(name) {
  const k = Object.keys(WAVE_COLORS).find(c => name.includes(c))
  return k ? WAVE_COLORS[k] : "#909399"
}

const sections = [
  { key: "waves", title: "波色统计", colorOf: waveColor },
  { key: "zodiacs", title: "生肖统计" },
  { key: "tails", title: "尾数统计" },
  { key: "segments", title: "波段统计" }
]

function waveOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.wave : ""
}

function zodiacOf(number) {
  const n = options.value.numbers.find(x => x.number === number)
  return n ? n.zodiac : ""
}

function missText(miss) {
  return miss === null || miss === undefined ? "—" : miss
}

function percent(count) {
  return trend.value && trend.value.hits ? ((count * 100) / trend.value.hits).toFixed(1) + "%" : "—"
}

function load() {
  loading.value = true
  getTrend(type.value, periods.value).then(res => {
    trend.value = res.data
  }).finally(() => {
    loading.value = false
  })
}

onMounted(() => {
  getLotteryOptions().then(res => {
    options.value = res.data
  }).finally(() => load())
})
</script>

<style scoped>
.card-title {
  font-weight: 600;
  margin-right: 10px;
}
.muted {
  color: #909399;
  font-size: 12px;
  margin-left: 6px;
}
.mt8 {
  margin-top: 8px;
}
.number-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
}
.number-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}
.number-cell.hot {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.08);
}
.cell-count {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}
</style>
