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
