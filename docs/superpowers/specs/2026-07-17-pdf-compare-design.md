# 考研择校网站 — PDF 导出 & 上岸难度对比 设计文档

**日期**: 2026-07-17
**状态**: 已确认

---

## 概述

在现有考研择校网站基础上新增两个功能：
1. **客户端 PDF 导出** — 使用 html2canvas + jsPDF 生成完整择校报告 PDF
2. **上岸难度对比** — ResultPage 内嵌可视化条形图 + 独立 `/compare/:id` 详细对比页

---

## 1. PDF 导出

### 1.1 方案

客户端生成：`html2canvas` 截图 + `jsPDF` 拼页。

### 1.2 新增依赖

- `html2canvas` — DOM 截图
- `jspdf` — PDF 生成

### 1.3 实现

**`src/lib/pdf.ts`** — 核心导出函数：
- `exportPDF(element: HTMLElement, filename: string)` → 返回 Promise
- 对目标 DOM 元素用 `html2canvas` 渲染为 canvas
- 计算 A4 比例分页，将 canvas 按页高裁切
- 逐页写入 `jsPDF` 实例
- 触发浏览器下载
- 处理边界：卡片跨页时尽量整卡移动到下一页（在卡片容器上加 `page-break-inside: avoid`）

**`ResultPage` 修改：**
- 将报告内容包裹在一个 `div#report-content` 引用中
- 导出按钮点击 → 显示 "正在生成 PDF..." loading → 调用 `exportPDF()` → 恢复
- 文件名：`考研择校报告_${学校名}_${YYYY-MM-DD}.pdf`
- 导出前临时隐藏 `.no-print` 元素（按钮等）
- 导出过程中对用户显示 spinner

### 1.4 导出内容范围

完整报告，包含：
- 标题「完整择校报告」
- 总结评估文字
- 上岸难度对比区域
- 所有院校卡片（冲/稳/保分组）
- 免责声明

---

## 2. 上岸难度对比

### 2.1 两层结构

**层一：ResultPage 内嵌版（替换现有简陋列表）**
- 水平条形图展示各校匹配度分数
- 按分数降序排列
- 每条带颜色区分 tier（冲刺=红色系、稳妥=蓝色系、保底=绿色系）
- 右侧显示难度标签和歧视标签
- 紧凑卡片式布局，一目了然
- 底部有「查看详细对比 →」入口

**层二：独立对比页 `/compare/:id`**
- 更大的展示空间
- 包含：
  - **匹配度排序条形图** — 与内嵌版相同但更宽敞
  - **多维度对比表** — 学校名称、考试科目、预估分数线、难度、歧视程度，表格式横向对比
  - **排序切换** — 可按匹配度、难度、歧视程度三个维度重新排序
- 顶部有返回报告的链接

### 2.2 新增组件

**`src/components/CompareBarChart.tsx`**
- Props: `schools: SchoolRecommendation[]`, `sortBy: 'match_score' | 'difficulty' | 'discrimination'`
- 渲染水平条形图（纯 CSS + Tailwind，不引入图表库）
- 每条显示：排名序号、学校名称、条形图、分数/等级

**`src/components/CompareTable.tsx`**
- Props: `schools: SchoolRecommendation[]`
- 响应式表格：移动端堆叠，桌面端完整表格
- 列：学校、tier、考试科目、预估分数、难度、歧视

**`src/lib/chart.ts`**
- 难度/歧视的排序权重映射函数
- 数据预处理

### 2.3 新增页面

**`src/pages/ComparePage.tsx`**
- 路由 `/compare/:id`
- 从 API 获取数据 → 展示条形图 + 对比表
- 排序切换标签（匹配度 | 难度 | 歧视）
- 顶部面包屑导航返回 ResultPage

### 2.4 ResultPage 修改

- 将现有简单难度列表替换为 `<CompareBarChart>` 内嵌版
- 图下方加「查看详细对比 →」链接到 `/compare/:id`
- 导出 PDF 时此区域一并导出

---

## 3. 路由变更

| 路径 | 页面 | 说明 |
|------|------|------|
| `/compare/:id` | ComparePage | **新增** — 详细对比页 |

`App.tsx` 新增一条 `<Route>`。

---

## 4. 文件变更总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/pdf.ts` | 新增 | PDF 生成工具 |
| `src/lib/chart.ts` | 新增 | 对比数据排序/映射 |
| `src/components/CompareBarChart.tsx` | 新增 | 水平条形图 |
| `src/components/CompareTable.tsx` | 新增 | 多维对比表 |
| `src/pages/ComparePage.tsx` | 新增 | 独立对比页 |
| `src/pages/ResultPage.tsx` | 修改 | 升级对比区 + PDF 导出升级 |
| `src/App.tsx` | 修改 | 新增路由 |
| `package.json` | 修改 | 新增 html2canvas、jspdf |

---

## 5. 边界处理

- **PDF 生成失败** — catch 后显示 toast 提示 "生成失败，请重试"
- **对比页数据加载中** — 显示 LoadingSpinner
- **对比页 API 失败** — 显示错误 + 返回链接
- **未付费用户** — 无法访问 `/compare/:id`（与 ResultPage 一致的付费检查）
- **导出中重复点击** — 禁用按钮直到完成

---

## 6. 不引入的内容

- 不新增后端 API
- 不引入重型图表库（ECharts/Recharts）
- 不修改现有数据模型和类型定义
