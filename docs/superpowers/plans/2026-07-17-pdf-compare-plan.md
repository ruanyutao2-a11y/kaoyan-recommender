# PDF 导出 & 上岸难度对比 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为考研择校网站新增客户端 PDF 导出（html2canvas + jsPDF）和上岸难度可视化对比（条形图 + 多维对比表 + 独立对比页）。

**Architecture:** 纯客户端方案。新增 `pdf.ts` 封装 PDF 生成、`chart.ts` 封装排序映射逻辑。新增 `CompareBarChart`（水平条形图）、`CompareTable`（多维表格）两个组件，以及 `/compare/:id` 对比页路由。ResultPage 升级现有导出按钮和简陋对比区。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS 3 + react-router-dom 7 + html2canvas + jsPDF

## 全局约束

- 不引入重型图表库（ECharts/Recharts），条形图纯 CSS + Tailwind 实现
- 不新增后端 API
- 不修改现有类型定义（`src/types/index.ts`）
- 所有颜色沿用 `tailwind.config.js` 中定义的 `ink`、`vermilion`、`indigo`、`paper` 等 token
- 字体沿用现有 `font-display`、`font-body`、`font-mono`

---

### Task 1: 安装 PDF 依赖

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `html2canvas@^1.4.1`、`jspdf@^2.5.2` 可用

- [ ] **Step 1: 安装 html2canvas 和 jspdf**

```bash
cd "D:\claude projects\kaoyan-recommender" && npm install html2canvas jspdf
```

- [ ] **Step 2: 验证安装**

```bash
cd "D:\claude projects\kaoyan-recommender" && node -e "require('html2canvas'); require('jspdf'); console.log('OK')"
```
Expected: `OK`

---

### Task 2: 创建对比数据工具库 `src/lib/chart.ts`

**Files:**
- Create: `src/lib/chart.ts`

**Interfaces:**
- Produces:
  - `type SortKey = 'match_score' | 'difficulty' | 'discrimination'`
  - `sortSchools(schools: SchoolRecommendation[], sortBy: SortKey): SchoolRecommendation[]`
  - `getSortValue(school: SchoolRecommendation, sortBy: SortKey): number`
  - `DIFFICULTY_ORDER: Record<string, number>`
  - `DISCRIMINATION_ORDER: Record<string, number>`

- [ ] **Step 1: 创建文件并实现排序逻辑**

写入 `src/lib/chart.ts`：

```typescript
import type { SchoolRecommendation } from '../types'

export const DIFFICULTY_ORDER: Record<string, number> = {
  '极难': 4,
  '较难': 3,
  '中等': 2,
  '较易': 1,
}

export const DISCRIMINATION_ORDER: Record<string, number> = {
  '高': 3,
  '中': 2,
  '低': 1,
}

export type SortKey = 'match_score' | 'difficulty' | 'discrimination'

export function getSortValue(school: SchoolRecommendation, sortBy: SortKey): number {
  switch (sortBy) {
    case 'match_score':
      return school.match_score
    case 'difficulty':
      return DIFFICULTY_ORDER[school.difficulty] ?? 0
    case 'discrimination':
      return DISCRIMINATION_ORDER[school.discrimination] ?? 0
  }
}

export function sortSchools(
  schools: SchoolRecommendation[],
  sortBy: SortKey,
): SchoolRecommendation[] {
  return [...schools].sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy))
}

export function getSortLabel(sortBy: SortKey): string {
  switch (sortBy) {
    case 'match_score':
      return '匹配度'
    case 'difficulty':
      return '上岸难度'
    case 'discrimination':
      return '歧视程度'
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/lib/chart.ts
```
Expected: 无错误

---

### Task 3: 创建 PDF 导出工具库 `src/lib/pdf.ts`

**Files:**
- Create: `src/lib/pdf.ts`

**Interfaces:**
- Produces: `exportPDF(element: HTMLElement, filename: string): Promise<void>`

- [ ] **Step 1: 创建文件并实现 PDF 生成**

写入 `src/lib/pdf.ts`：

```typescript
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pdfHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight
  }

  pdf.save(filename)
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/lib/pdf.ts
```
Expected: 无错误

---

### Task 4: 创建 CompareBarChart 组件

**Files:**
- Create: `src/components/CompareBarChart.tsx`

**Interfaces:**
- Consumes: `sortSchools`, `getSortValue`, `SortKey` from `../lib/chart`
- Consumes: `SchoolRecommendation` from `../types`
- Produces: `<CompareBarChart schools={...} sortBy={...} compact={...} />`
  - `schools: SchoolRecommendation[]`
  - `sortBy: SortKey`
  - `compact?: boolean` — 紧凑模式（ResultPage 内嵌用）

- [ ] **Step 1: 创建水平条形图组件**

写入 `src/components/CompareBarChart.tsx`：

```typescript
import type { SchoolRecommendation } from '../types'
import { sortSchools, getSortValue, getSortLabel } from '../lib/chart'
import type { SortKey } from '../lib/chart'

interface Props {
  schools: SchoolRecommendation[]
  sortBy: SortKey
  compact?: boolean
}

const TIER_BAR_COLORS: Record<string, string> = {
  '冲刺': 'bg-vermilion',
  '稳妥': 'bg-indigo',
  '保底': 'bg-green-600',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  '极难': 'text-red-600 bg-red-50',
  '较难': 'text-orange-600 bg-orange-50',
  '中等': 'text-yellow-600 bg-yellow-50',
  '较易': 'text-green-600 bg-green-50',
}

const DISCRIMINATION_COLORS: Record<string, string> = {
  '高': 'text-red-600 bg-red-50',
  '中': 'text-yellow-600 bg-yellow-50',
  '低': 'text-green-600 bg-green-50',
}

export default function CompareBarChart({ schools, sortBy, compact = false }: Props) {
  const sorted = sortSchools(schools, sortBy)
  const maxVal = Math.max(...sorted.map(s => getSortValue(s, sortBy)), 1)

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-sm text-graphite mb-3">
          按{getSortLabel(sortBy)}排序 · 共 {sorted.length} 所院校
        </p>
      )}
      {sorted.map((school, i) => {
        const val = getSortValue(school, sortBy)
        const pct = Math.round((val / maxVal) * 100)
        const barColor = TIER_BAR_COLORS[school.tier] || 'bg-indigo'

        return (
          <div key={school.name} className="group">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-xs text-graphite w-5 text-right shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-ink truncate">{school.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                school.tier === '冲刺' ? 'bg-red-100 text-red-700' :
                school.tier === '稳妥' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}>
                {school.tier}
              </span>
              {!compact && (
                <>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[school.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                    {school.difficulty}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DISCRIMINATION_COLORS[school.discrimination] || 'bg-gray-100 text-gray-600'}`}>
                    歧视{school.discrimination}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-xs text-graphite w-12 text-right shrink-0">
                {sortBy === 'match_score' ? `${val}分` : val}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/components/CompareBarChart.tsx
```
Expected: 无错误

---

### Task 5: 创建 CompareTable 组件

**Files:**
- Create: `src/components/CompareTable.tsx`

**Interfaces:**
- Consumes: `sortSchools`, `SortKey` from `../lib/chart`
- Consumes: `SchoolRecommendation` from `../types`
- Produces: `<CompareTable schools={...} sortBy={...} />`
  - `schools: SchoolRecommendation[]`
  - `sortBy: SortKey`

- [ ] **Step 1: 创建多维对比表组件**

写入 `src/components/CompareTable.tsx`：

```typescript
import type { SchoolRecommendation } from '../types'
import { sortSchools } from '../lib/chart'
import type { SortKey } from '../lib/chart'

interface Props {
  schools: SchoolRecommendation[]
  sortBy: SortKey
}

const DIFFICULTY_COLORS: Record<string, string> = {
  '极难': 'text-red-600',
  '较难': 'text-orange-600',
  '中等': 'text-yellow-600',
  '较易': 'text-green-600',
}

const DISCRIMINATION_COLORS: Record<string, string> = {
  '高': 'text-red-600',
  '中': 'text-yellow-600',
  '低': 'text-green-600',
}

const TIER_COLORS: Record<string, string> = {
  '冲刺': 'bg-red-50 text-red-700',
  '稳妥': 'bg-blue-50 text-blue-700',
  '保底': 'bg-green-50 text-green-700',
}

export default function CompareTable({ schools, sortBy }: Props) {
  const sorted = sortSchools(schools, sortBy)

  return (
    <div className="overflow-x-auto">
      {/* Desktop table */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-3 font-medium text-graphite">学校</th>
            <th className="text-left py-3 px-3 font-medium text-graphite">层次</th>
            <th className="text-left py-3 px-3 font-medium text-graphite">考试科目</th>
            <th className="text-left py-3 px-3 font-medium text-graphite">预估分数</th>
            <th className="text-left py-3 px-3 font-medium text-graphite">上岸难度</th>
            <th className="text-left py-3 px-3 font-medium text-graphite">本科歧视</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((school) => (
            <tr key={school.name} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="py-3 px-3 font-medium text-ink">{school.name}</td>
              <td className="py-3 px-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[school.tier] || ''}`}>
                  {school.tier}
                </span>
              </td>
              <td className="py-3 px-3 text-graphite text-xs">{school.exam_subjects.join('、')}</td>
              <td className="py-3 px-3 font-mono text-sm text-ink">{school.estimate_score}</td>
              <td className={`py-3 px-3 font-medium text-sm ${DIFFICULTY_COLORS[school.difficulty] || ''}`}>
                {school.difficulty}
              </td>
              <td className={`py-3 px-3 font-medium text-sm ${DISCRIMINATION_COLORS[school.discrimination] || ''}`}>
                {school.discrimination}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {sorted.map((school) => (
          <div key={school.name} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-ink">{school.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[school.tier] || ''}`}>
                {school.tier}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-graphite">考试科目</span>
                <p className="text-ink mt-0.5">{school.exam_subjects.join('、')}</p>
              </div>
              <div>
                <span className="text-graphite">预估分数</span>
                <p className="font-mono text-ink mt-0.5">{school.estimate_score}</p>
              </div>
              <div>
                <span className="text-graphite">上岸难度</span>
                <p className={`font-medium mt-0.5 ${DIFFICULTY_COLORS[school.difficulty] || ''}`}>
                  {school.difficulty}
                </p>
              </div>
              <div>
                <span className="text-graphite">本科歧视</span>
                <p className={`font-medium mt-0.5 ${DISCRIMINATION_COLORS[school.discrimination] || ''}`}>
                  {school.discrimination}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/components/CompareTable.tsx
```
Expected: 无错误

---

### Task 6: 升级 ResultPage

**Files:**
- Modify: `src/pages/ResultPage.tsx`

**Interfaces:**
- Consumes: `exportPDF` from `../lib/pdf`
- Consumes: `CompareBarChart` from `../components/CompareBarChart`
- Produces: 无新增导出，内部行为变更

- [ ] **Step 1: 重写 ResultPage.tsx**

写入 `src/pages/ResultPage.tsx`（完整替换）：

```typescript
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { exportPDF } from '../lib/pdf'
import type { EvaluationResult } from '../types'
import SchoolCard from '../components/SchoolCard'
import CompareBarChart from '../components/CompareBarChart'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    api.getResult(id)
      .then(res => {
        if (!res.isPaid) {
          navigate(`/result/${id}/preview`, { replace: true })
          return
        }
        setResult(res.data as EvaluationResult)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current || !result) return
    setPdfLoading(true)
    setPdfError('')
    try {
      const schoolName = result.recommendations[0]?.name || '报告'
      const date = new Date().toISOString().slice(0, 10)
      await exportPDF(reportRef.current, `考研择校报告_${schoolName}_${date}.pdf`)
    } catch (err: any) {
      setPdfError(err.message || 'PDF 生成失败，请重试')
    } finally {
      setPdfLoading(false)
    }
  }, [result])

  if (loading) return <LoadingSpinner message="加载完整报告..." />
  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-vermilion">{error}</p>
      </div>
    )
  }
  if (!result) return null

  const tiers = ['冲刺', '稳妥', '保底'] as const

  return (
    <div className="min-h-screen bg-paper">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .school-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Report content — targeted by PDF export */}
        <div ref={reportRef} id="report-content">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-ink font-bold mb-2">完整择校报告</h1>
            <p className="text-graphite">{result.summary.overall_assessment}</p>
          </div>

          {/* Export PDF button */}
          <div className="text-center mb-8 no-print">
            <button
              onClick={handleExportPDF}
              disabled={pdfLoading}
              className="px-6 py-3 bg-indigo text-white font-medium rounded-lg
                         hover:bg-blue-700 active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? '⏳ 正在生成 PDF...' : '📄 导出 PDF'}
            </button>
            <p className="text-graphite text-xs mt-2">一键下载完整择校报告</p>
            {pdfError && (
              <p className="text-vermilion text-xs mt-2">{pdfError}</p>
            )}
          </div>

          {/* 上岸难度对比 — 内嵌条形图 */}
          <div className="mb-8 p-4 sm:p-6 bg-white rounded-xl border border-gray-100">
            <h2 className="font-display text-lg text-ink font-semibold mb-4">
              📊 上岸难度对比
            </h2>
            <CompareBarChart schools={result.recommendations} sortBy="match_score" compact />
            <div className="mt-4 pt-3 border-t border-gray-100 text-right no-print">
              <Link
                to={`/compare/${id}`}
                className="text-sm text-indigo hover:text-indigo/80 font-medium"
              >
                查看详细对比 →
              </Link>
            </div>
          </div>

          {/* Schools by tier */}
          {tiers.map(tier => {
            const schools = result.recommendations.filter(s => s.tier === tier)
            if (schools.length === 0) return null

            const tierLabel = {
              '冲刺': '🔥 冲刺院校',
              '稳妥': '⭐ 稳妥院校',
              '保底': '✅ 保底院校',
            }[tier]

            return (
              <div key={tier} className="mb-10">
                <h2 className="font-display text-xl text-ink mb-4 font-semibold">{tierLabel}</h2>
                <div className="space-y-4">
                  {schools.map((school, i) => (
                    <div key={school.name} className="school-card">
                      <SchoolCard school={school} index={i} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Disclaimer */}
          <div className="mt-10 p-4 bg-white rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-graphite leading-relaxed">
              {result.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/pages/ResultPage.tsx
```
Expected: 无错误（可能需要 `tsc -b`，如有模块解析问题则用 `npx tsc --noEmit`）

---

### Task 7: 创建 ComparePage 独立对比页

**Files:**
- Create: `src/pages/ComparePage.tsx`

**Interfaces:**
- Consumes: `api.getResult` from `../lib/api`
- Consumes: `sortSchools`, `getSortLabel`, `SortKey` from `../lib/chart`
- Consumes: `CompareBarChart` from `../components/CompareBarChart`
- Consumes: `CompareTable` from `../components/CompareTable`
- Produces: 页面组件，路由 `/compare/:id`

- [ ] **Step 1: 创建 ComparePage**

写入 `src/pages/ComparePage.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { EvaluationResult } from '../types'
import type { SortKey } from '../lib/chart'
import { sortSchools, getSortLabel } from '../lib/chart'
import CompareBarChart from '../components/CompareBarChart'
import CompareTable from '../components/CompareTable'
import LoadingSpinner from '../components/LoadingSpinner'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'match_score', label: '匹配度' },
  { key: 'difficulty', label: '上岸难度' },
  { key: 'discrimination', label: '歧视程度' },
]

export default function ComparePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('match_score')

  useEffect(() => {
    if (!id) return
    api.getResult(id)
      .then(res => {
        if (!res.isPaid) {
          navigate(`/result/${id}/preview`, { replace: true })
          return
        }
        setResult(res.data as EvaluationResult)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <LoadingSpinner message="加载对比数据..." />
  if (error) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
        <p className="text-vermilion">{error}</p>
        <Link to={`/result/${id}`} className="text-sm text-indigo hover:underline">
          ← 返回完整报告
        </Link>
      </div>
    )
  }
  if (!result) return null

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <Link
          to={`/result/${id}`}
          className="inline-block text-sm text-indigo hover:text-indigo/80 mb-6"
        >
          ← 返回完整报告
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-ink font-bold mb-2">上岸难度对比</h1>
          <p className="text-graphite">
            {result.recommendations.length} 所院校横向对比 · 选择最适合你的目标
          </p>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 w-fit">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === opt.key
                  ? 'bg-indigo text-white'
                  : 'text-graphite hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Bar chart section */}
        <section className="mb-10 bg-white rounded-xl border border-gray-100 p-4 sm:p-6">
          <h2 className="font-display text-lg text-ink font-semibold mb-4">
            📊 {getSortLabel(sortBy)}排序
          </h2>
          <CompareBarChart schools={result.recommendations} sortBy={sortBy} />
        </section>

        {/* Comparison table section */}
        <section className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6">
          <h2 className="font-display text-lg text-ink font-semibold mb-4">
            📋 多维度对比表
          </h2>
          <CompareTable schools={result.recommendations} sortBy={sortBy} />
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc --noEmit src/pages/ComparePage.tsx
```
Expected: 无错误

---

### Task 8: 注册 ComparePage 路由

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ComparePage` from `../pages/ComparePage`
- Produces: 无新增导出

- [ ] **Step 1: 在 App.tsx 中新增路由**

将 `src/App.tsx` 的第 5 行（RedeemPage import 之后）插入 import，并在 Routes 中新增 Route。最终文件内容：

```typescript
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EvaluatingPage from './pages/EvaluatingPage'
import PreviewPage from './pages/PreviewPage'
import ResultPage from './pages/ResultPage'
import RedeemPage from './pages/RedeemPage'
import ComparePage from './pages/ComparePage'

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/evaluating/:id" element={<EvaluatingPage />} />
        <Route path="/result/:id/preview" element={<PreviewPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/compare/:id" element={<ComparePage />} />
        <Route path="/redeem" element={<RedeemPage />} />
    </Routes>
  )
}
```

- [ ] **Step 2: 全量 TypeScript 编译检查**

```bash
cd "D:\claude projects\kaoyan-recommender" && npx tsc -b
```
Expected: 无错误

- [ ] **Step 3: 启动开发服务器验证**

```bash
cd "D:\claude projects\kaoyan-recommender" && npm run dev
```
Expected: Vite 启动成功，控制台无报错

---

## 验证清单

完成所有 Task 后，手动验证以下场景：

1. **PDF 导出按钮状态** — 点击 → 按钮显示 loading → 下载 PDF → 按钮恢复
2. **PDF 内容完整性** — 打开 PDF 确认包含标题、对比图、所有院校卡片、免责声明
3. **ResultPage 对比区** — 显示水平条形图，按匹配度降序排列，院校名称 + tier 标签可见
4. **"查看详细对比" 链接** — 点击跳转到 `/compare/:id`
5. **ComparePage 排序切换** — 三个标签（匹配度/上岸难度/歧视程度）点击后条形图和表格同步重排
6. **ComparePage 响应式** — 移动端表格变为卡片布局
7. **ComparePage 返回链接** — 点击返回 ResultPage
8. **未付费用户保护** — 未付费用户访问 `/compare/:id` 会被重定向到 preview
