import type { SchoolRecommendation } from '../types'
import StampSeal from './StampSeal'

interface Props {
  school: SchoolRecommendation
  isLocked?: boolean
  index?: number
}

const TIER_COLORS: Record<string, { bg: string; badge: string }> = {
  '冲刺': { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
  '稳妥': { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  '保底': { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
}

export default function SchoolCard({ school, isLocked = false, index = 0 }: Props) {
  const colors = TIER_COLORS[school.tier] || TIER_COLORS['稳妥']

  if (isLocked) {
    return (
      <div className={`relative rounded-xl p-6 ${colors.bg} border border-gray-100 opacity-60 blur-[2px] select-none`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl text-ink">??????</h3>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.badge}`}>
            {school.tier}
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className={`relative rounded-xl p-6 ${colors.bg} border border-gray-100 hover:shadow-md transition-shadow`}>
      <StampSeal tier={school.tier} delay={index * 150} />

      <div className="flex items-center justify-between mb-3 pr-8">
        <h3 className="font-display text-xl text-ink">{school.name}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.badge}`}>
          {school.tier}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo rounded-full transition-all duration-1000"
            style={{ width: `${school.match_score}%` }}
          />
        </div>
        <span className="font-mono text-sm text-indigo font-medium">{school.match_score}分</span>
      </div>

      <p className="text-sm text-ink/80 mb-4 leading-relaxed">{school.reason}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-graphite text-xs">⚠ 风险提示</span>
          <p className="text-ink/70 mt-0.5">{school.risk_warning}</p>
        </div>
        <div>
          <span className="text-graphite text-xs">📚 考试科目</span>
          <p className="text-ink/70 mt-0.5">{school.exam_subjects.join('、')}</p>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-graphite text-xs">📊 预估分数线</span>
        <span className="font-mono text-sm text-ink font-medium">{school.estimate_score}</span>
      </div>

      {school.notes && (
        <p className="mt-3 text-xs text-graphite leading-relaxed border-t border-gray-200 pt-3">
          {school.notes}
        </p>
      )}
    </div>
  )
}
