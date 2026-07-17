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
