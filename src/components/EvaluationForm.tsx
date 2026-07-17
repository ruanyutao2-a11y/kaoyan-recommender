import { useState } from 'react'
import type { FormEvent } from 'react'
import type { EvaluationInput } from '../types'

interface Props {
  onSubmit: (input: EvaluationInput) => void
  isLoading: boolean
}

const REGIONS = ['不限', '北京', '上海', '广东', '江苏', '浙江', '湖北', '四川', '陕西', '天津', '重庆', '山东', '湖南', '辽宁', '其他']

export default function EvaluationForm({ onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<EvaluationInput>({
    school: '',
    major: '',
    estimated_score: '',
    target_major: '',
    region: '',
    english_level: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof EvaluationInput, string>>>({})

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.school.trim()) e.school = '请填写本科院校'
    if (!form.major.trim()) e.major = '请填写本科专业'
    if (!form.target_major.trim()) e.target_major = '请填写目标专业'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (validate()) {
      onSubmit({
        ...form,
        estimated_score: form.estimated_score?.trim() || undefined,
        region: form.region?.trim() || undefined,
        english_level: form.english_level?.trim() || undefined,
      })
    }
  }

  function updateField(field: keyof EvaluationInput, value: string) {
    setForm((prev: EvaluationInput) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const inputClass = (field: keyof EvaluationInput) =>
    `w-full px-4 py-3 rounded-lg border ${
      errors[field] ? 'border-vermilion' : 'border-gray-200'
    } bg-white text-ink placeholder-graphite focus:border-indigo focus:ring-1 focus:ring-indigo transition-colors text-base`

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            本科院校 <span className="text-vermilion">*</span>
          </label>
          <input
            type="text"
            className={inputClass('school')}
            placeholder="如：山东大学"
            value={form.school}
            onChange={e => updateField('school', e.target.value)}
          />
          {errors.school && <p className="mt-1 text-xs text-vermilion">{errors.school}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            本科专业 <span className="text-vermilion">*</span>
          </label>
          <input
            type="text"
            className={inputClass('major')}
            placeholder="如：计算机科学与技术"
            value={form.major}
            onChange={e => updateField('major', e.target.value)}
          />
          {errors.major && <p className="mt-1 text-xs text-vermilion">{errors.major}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          目标专业 <span className="text-vermilion">*</span>
        </label>
        <input
          type="text"
          className={inputClass('target_major')}
          placeholder="如：计算机科学与技术（可跨专业）"
          value={form.target_major}
          onChange={e => updateField('target_major', e.target.value)}
        />
        {errors.target_major && <p className="mt-1 text-xs text-vermilion">{errors.target_major}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">预估考研分数</label>
          <input
            type="text"
            className={inputClass('estimated_score')}
            placeholder="如：380"
            value={form.estimated_score}
            onChange={e => updateField('estimated_score', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">意向地区</label>
          <select
            className={inputClass('region')}
            value={form.region}
            onChange={e => updateField('region', e.target.value)}
          >
            {REGIONS.map(r => (
              <option key={r} value={r === '不限' ? '' : r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">英语水平</label>
          <select
            className={inputClass('english_level')}
            value={form.english_level}
            onChange={e => updateField('english_level', e.target.value)}
          >
            <option value="">不限</option>
            <option value="CET-4">CET-4</option>
            <option value="CET-6">CET-6</option>
            <option value="IELTS 6.5+">IELTS 6.5+</option>
            <option value="TOEFL 90+">TOEFL 90+</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3.5 px-6 bg-vermilion text-white font-medium text-lg rounded-lg
                   hover:bg-red-700 active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
      >
        {isLoading ? '分析中…' : '开始评估 →'}
      </button>
    </form>
  )
}
