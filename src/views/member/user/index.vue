<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="登录账号" prop="userName">
        <el-input v-model="queryParams.userName" placeholder="请输入登录账号" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="用户昵称" prop="nickName">
        <el-input v-model="queryParams.nickName" placeholder="请输入用户昵称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="用户状态" clearable style="width: 240px">
          <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="注册时间" style="width: 308px">
        <el-date-picker v-model="dateRange" value-format="YYYY-MM-DD" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期"></el-date-picker>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns" storageKey="member-user-columns"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="userList">
      <el-table-column label="用户编号" align="center" key="userId" prop="userId" v-if="columns.userId.visible" />
      <el-table-column label="登录账号" align="center" key="userName" v-if="columns.userName.visible" :show-overflow-tooltip="true">
        <template #default="scope">
          <a v-if="canQuery" class="link-type" style="cursor:pointer" @click="handleViewData(scope.row)">{{ scope.row.userName }}</a>
          <span v-else>{{ scope.row.userName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="用户昵称" align="center" key="nickName" prop="nickName" v-if="columns.nickName.visible" :show-overflow-tooltip="true" />
      <el-table-column label="状态" align="center" key="status" v-if="columns.status.visible">
        <template #default="scope">
          <el-switch
            v-model="scope.row.status"
            active-value="0"
            inactive-value="1"
            :disabled="!canEdit"
            @change="handleStatusChange(scope.row)"
          ></el-switch>
        </template>
      </el-table-column>
      <el-table-column label="注册IP" align="center" key="registerIp" prop="registerIp" v-if="columns.registerIp.visible" width="140" :show-overflow-tooltip="true" />
      <el-table-column label="最后登录IP" align="center" key="loginIp" prop="loginIp" v-if="columns.loginIp.visible" width="140" :show-overflow-tooltip="true" />
      <el-table-column label="最后登录时间" align="center" key="loginDate" prop="loginDate" v-if="columns.loginDate.visible" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.loginDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" align="center" key="createTime" prop="createTime" v-if="columns.createTime.visible" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="100" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="重置密码" placement="top">
            <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)" v-hasPermi="['member:user:resetPwd']"></el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 会员详情抽屉 -->
    <member-user-view-drawer ref="memberUserViewRef" />
  </div>
</template>

<script setup name="MemberUser">
import MemberUserViewDrawer from "./view"
import { checkPermi } from "@/utils/permission"
import { usePasswordRule } from "@/utils/passwordRule"
import { listMemberUser, changeMemberUserStatus, resetMemberUserPwd } from "@/api/member/user"

const { proxy } = getCurrentInstance()
const { pwdPromptValidator } = usePasswordRule()
const { sys_normal_disable } = useDict("sys_normal_disable")

const userList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const dateRange = ref([])
const canQuery = checkPermi(["member:user:query"])
const canEdit = checkPermi(["member:user:edit"])
// 列显隐信息
const columns = ref({
  userId: { label: '用户编号', visible: true },
  userName: { label: '登录账号', visible: true },
  nickName: { label: '用户昵称', visible: true },
  status: { label: '状态', visible: true },
  registerIp: { label: '注册IP', visible: true },
  loginIp: { label: '最后登录IP', visible: true },
  loginDate: { label: '最后登录时间', visible: true },
  createTime: { label: '注册时间', visible: true }
})

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    userName: undefined,
    nickName: undefined,
    status: undefined
  }
})

const { queryParams } = toRefs(data)

/** 查询会员列表 */
function getList() {
  loading.value = true
  listMemberUser(proxy.addDateRange(queryParams.value, dateRange.value)).then(res => {
    loading.value = false
    userList.value = res.rows
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

/** 用户状态修改 */
function handleStatusChange(row) {
  const text = row.status === "0" ? "启用" : "停用"
  const tip = row.status === "0" ? "" : "停用后该用户所有已登录会话将立即失效，"
  proxy.$modal.confirm(tip + '确认要"' + text + '""' + row.userName + '"用户吗?').then(function () {
    return changeMemberUserStatus(row.userId, row.status)
  }).then(() => {
    proxy.$modal.msgSuccess(text + "成功")
  }).catch(function () {
    row.status = row.status === "0" ? "1" : "0"
  })
}

/** 重置密码按钮操作 */
function handleResetPwd(row) {
  proxy.$prompt(`请输入「${row.userName}」的新密码（重置后该用户需重新登录）`, "重置密码", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    closeOnClickModal: false,
    inputValidator: pwdPromptValidator
  }).then(({ value }) => {
    resetMemberUserPwd(row.userId, value).then(() => {
      proxy.$modal.msgSuccess("修改成功，新密码是：" + value)
    })
  }).catch(() => {})
}

/** 详情操作 */
function handleViewData(row) {
  proxy.$refs["memberUserViewRef"].open(row.userId)
}

onMounted(() => {
  getList()
})
</script>
