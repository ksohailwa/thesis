type Props = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = '' }: Props) {
  return (
    <div className={`rounded-xl bg-white shadow-sm border border-neutral-200 p-6 ${className}`}>
      {children}
    </div>
  )
}
