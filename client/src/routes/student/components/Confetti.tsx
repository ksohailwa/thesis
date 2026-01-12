import { useMemo } from 'react'

export default function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 3 + Math.random() * 2,
        color: ['#6366f1', '#ec4899', '#f97316', '#10b981'][
          Math.floor(Math.random() * 4)
        ],
      })),
    []
  )

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
      {pieces.map((piece, idx) => (
        <span
          key={idx}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
