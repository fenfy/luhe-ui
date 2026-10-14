<template>
  <div ref="chartRef" class="trend-bar"></div>
</template>

<script setup name="TrendBar">
import * as echarts from 'echarts'

const props = defineProps({
  // [{ key, count, miss }]
  items: { type: Array, default: () => [] },
  // 每个分类的颜色（如波色）；不传时用统一颜色
  colorOf: { type: Function, default: null },
  // 总开出次数，用于提示框里的占比
  hits: { type: Number, default: 0 },
  // 是否在提示框显示当前遗漏（特码组）
  showMiss: { type: Boolean, default: false }
})

const BAR_COLOR = '#3e7bfa'
const chartRef = ref(null)
let chart = null

function render() {
  if (!chart) return
  chart.setOption({
    grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const item = props.items[params[0].dataIndex]
        const pct = props.hits ? ((item.count * 100) / props.hits).toFixed(1) + '%' : '—'
        const miss = props.showMiss ? `<br/>当前遗漏：${item.miss === null ? '近 100 期内未开出' : item.miss + ' 期'}` : ''
        return `${item.key}<br/>出现：${item.count} 次（${pct}）${miss}`
      }
    },
    xAxis: {
      type: 'category',
      data: props.items.map(i => i.key),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#606266', interval: 0 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#909399' }
    },
    series: [{
      type: 'bar',
      barMaxWidth: 28,
      data: props.items.map(i => ({
        value: i.count,
        itemStyle: { color: props.colorOf ? props.colorOf(i.key) : BAR_COLOR, borderRadius: [4, 4, 0, 0] }
      })),
      label: { show: true, position: 'top', color: '#606266', fontSize: 11 }
    }]
  }, true)
}

function resize() {
  chart && chart.resize()
}

watch(() => [props.items, props.hits, props.showMiss], render, { deep: true })

onMounted(() => {
  chart = echarts.init(chartRef.value)
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart && chart.dispose()
  chart = null
})
</script>

<style scoped>
.trend-bar {
  width: 100%;
  height: 220px;
}
</style>
