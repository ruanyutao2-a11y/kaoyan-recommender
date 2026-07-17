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
