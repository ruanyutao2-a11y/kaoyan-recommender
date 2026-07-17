import { useEffect, useState } from 'react'

interface Props {
  tier: '冲刺' | '稳妥' | '保底'
  delay?: number
}

const TIER_LABELS: Record<string, string> = {
  '冲刺': '冲',
  '稳妥': '稳',
  '保底': '保',
}

export default function StampSeal({ tier, delay = 0 }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={`absolute -top-3 -right-3 w-12 h-12 rounded-full border-2 border-vermilion
                  flex items-center justify-center bg-white/90
                  transition-all duration-600 ease-out
                  ${visible ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-12 scale-50'}`}
      style={{ transitionDuration: '600ms' }}
      aria-label={`${tier}院校`}
    >
      <span className="font-display text-vermilion text-lg font-bold leading-none">
        {TIER_LABELS[tier]}
      </span>
    </div>
  )
}
