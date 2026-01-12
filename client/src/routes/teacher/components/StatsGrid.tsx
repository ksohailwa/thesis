type StatItem = {
  label: string
  value: string | number
}

type StatsGridProps = {
  items: StatItem[]
  columns?: 3 | 5
  size?: 'normal' | 'small'
}

export default function StatsGrid({ items, columns = 3, size = 'normal' }: StatsGridProps) {
  const colClass = columns === 5 ? 'md:grid-cols-5' : 'md:grid-cols-3'
  const padding = size === 'small' ? 'p-4' : 'p-5'
  const labelClass = size === 'small' ? 'text-xs' : 'text-sm'
  const valueClass = size === 'small' ? 'text-xl' : 'text-2xl'

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`bg-white rounded-2xl border-2 border-gray-100 ${padding} shadow-sm`}
        >
          <div className={`${labelClass} text-gray-500`}>{item.label}</div>
          <div className={`${valueClass} font-semibold text-gray-900 mt-2`}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}
