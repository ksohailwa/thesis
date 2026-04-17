import { memo, type KeyboardEvent } from 'react'
import type { Blank, BlankState } from '../types'

type BlankInputProps = {
  blank: Blank
  state: BlankState
  isLocked: boolean
  feedbackEnabled: boolean
  onCheck: (blank: Blank, value: string) => void
  onFocus: (blank: Blank) => void
  onBlur: (blank: Blank) => void
  onFocusNext: (currentKey: string) => void
  onUpdateValue: (blankKey: string, value: string) => void
}

function BlankInput({
  blank,
  state,
  isLocked,
  feedbackEnabled,
  onCheck,
  onFocus,
  onBlur,
  onFocusNext,
  onUpdateValue,
}: BlankInputProps) {
  const length = blank.word.length
  const letterFeedback = state.letterFeedback || []
  const letters = Array.from({ length }, (_, i) => state.value[i] || '')

  const updateLetters = (nextLetters: string[]) => {
    onUpdateValue(blank.key, nextLetters.join(''))
  }

  const handleLetterChange = (index: number, value: string) => {
    const clean = value.slice(-1)
    if (value.length > 1) {
      const clipped = value.slice(0, length).split('')
      const nextLetters = Array.from({ length }, (_, i) => clipped[i] || '')
      updateLetters(nextLetters)
      const lastId = `blank-${blank.key}-${Math.min(length - 1, clipped.length - 1)}`
      const lastEl = document.getElementById(lastId)
      if (lastEl) lastEl.focus()
      return
    }
    const nextLetters = [...letters]
    nextLetters[index] = clean
    updateLetters(nextLetters)
    if (clean && index < length - 1) {
      const nextEl = document.getElementById(`blank-${blank.key}-${index + 1}`)
      if (nextEl) nextEl.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCheck(blank, state.value)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      onFocusNext(blank.key)
      return
    }
    if (e.key === 'Backspace' && !letters[index] && index > 0) {
      const prevEl = document.getElementById(`blank-${blank.key}-${index - 1}`)
      if (prevEl) prevEl.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      const prevEl = document.getElementById(`blank-${blank.key}-${index - 1}`)
      if (prevEl) prevEl.focus()
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      const nextEl = document.getElementById(`blank-${blank.key}-${index + 1}`)
      if (nextEl) nextEl.focus()
    }
  }

  return (
    <span
      key={blank.key}
      className="inline-flex items-center gap-1 mx-1 relative"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onFocusCapture={() => onFocus(blank)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onBlur(blank)
      }}
    >
      <span className="inline-flex items-center gap-1">
        {letters.map((letter, i) => {
          const status = feedbackEnabled ? letterFeedback[i] : undefined
          const baseClass = isLocked
            ? 'border-green-500 text-green-700 bg-green-50'
            : status === true
              ? 'border-green-500 text-green-700 bg-green-50'
              : status === false
                ? 'border-red-500 text-red-700 bg-red-50'
                : 'border-purple-300 text-gray-700 bg-purple-50/50'
          return (
            <input
              key={`${blank.key}-${i}`}
              id={`blank-${blank.key}-${i}`}
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={1}
              value={letter}
              disabled={false}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleLetterChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-8 h-10 border rounded-md text-center font-bold text-lg outline-none transition-all ${baseClass}`}
            />
          )
        })}
      </span>
      <div className="flex items-center gap-1 ml-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCheck(blank, state.value)
          }}
          disabled={isLocked}
          className={`px-2 py-1 text-xs font-semibold rounded border transition ${
            isLocked
              ? 'border-green-300 text-green-600 bg-green-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Check
        </button>
      </div>
      {isLocked && (
        <span className="absolute -top-3 -right-2 text-green-500 text-xs">
          OK
        </span>
      )}
    </span>
  )
}

// Memoize to prevent re-renders during audio playback
export default memo(BlankInput, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.blank.key === nextProps.blank.key &&
    prevProps.state.value === nextProps.state.value &&
    prevProps.state.feedback === nextProps.state.feedback &&
    prevProps.state.correct === nextProps.state.correct &&
    prevProps.isLocked === nextProps.isLocked &&
    prevProps.feedbackEnabled === nextProps.feedbackEnabled &&
    JSON.stringify(prevProps.state.letterFeedback) === JSON.stringify(nextProps.state.letterFeedback)
  )
})
