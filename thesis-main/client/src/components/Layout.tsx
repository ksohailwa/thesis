import AppHeader from './AppHeader'

type Props = {
  children: React.ReactNode
  showHeader?: boolean
  onHelp?: () => void
  onScale?: (delta: number) => void
}

export default function Layout({ children, showHeader = true, onHelp, onScale }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {showHeader && <AppHeader onHelp={onHelp} onScale={onScale} />}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
