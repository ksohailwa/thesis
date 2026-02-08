import { useState } from 'react'
import { Brain } from 'lucide-react'

type MentalEffortViewProps = {
  paragraphNumber: number
  onSubmit: (score: number) => void
}

// 9-point mental effort scale with emoticons and labels
const EFFORT_SCALE = [
  { value: 1, emoji: '😌', label: 'Very, very low effort' },
  { value: 2, emoji: '😊', label: 'Very low effort' },
  { value: 3, emoji: '🙂', label: 'Low effort' },
  { value: 4, emoji: '😐', label: 'Rather low effort' },
  { value: 5, emoji: '😶', label: 'Neither low nor high effort' },
  { value: 6, emoji: '🤔', label: 'Rather high effort' },
  { value: 7, emoji: '😓', label: 'High effort' },
  { value: 8, emoji: '😰', label: 'Very high effort' },
  { value: 9, emoji: '🤯', label: 'Very, very high effort' },
]

export default function MentalEffortView({
  paragraphNumber,
  onSubmit,
}: MentalEffortViewProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null)
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)

  const displayScore = hoveredScore ?? selectedScore
  const displayItem = displayScore ? EFFORT_SCALE.find(s => s.value === displayScore) : null

  const handleSubmit = () => {
    if (selectedScore !== null) {
      onSubmit(selectedScore)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">How Hard Was That?</h2>
          </div>
          <p className="text-gray-600">
            After completing paragraph {paragraphNumber}, please rate how much mental effort you invested.
          </p>
        </div>

        {/* Scale Selection */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Emoji display for selected/hovered score */}
          <div className="text-center py-4">
            <div className="text-6xl mb-2 transition-all duration-200">
              {displayItem?.emoji || '🤔'}
            </div>
            <div className="text-lg font-medium text-gray-700 h-6">
              {displayItem?.label || 'Select your effort level'}
            </div>
          </div>

          {/* 9-point scale buttons */}
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-gray-500 px-2">
              <span>Low effort</span>
              <span>High effort</span>
            </div>

            <div className="flex justify-center gap-2">
              {EFFORT_SCALE.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setSelectedScore(item.value)}
                  onMouseEnter={() => setHoveredScore(item.value)}
                  onMouseLeave={() => setHoveredScore(null)}
                  className={`
                    w-10 h-10 rounded-full font-bold text-lg transition-all duration-150
                    flex items-center justify-center
                    ${selectedScore === item.value
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-200 scale-110'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 hover:scale-105'
                    }
                  `}
                  title={item.label}
                >
                  {item.value}
                </button>
              ))}
            </div>

            {/* Scale labels */}
            <div className="flex justify-between text-xs text-gray-400 px-1">
              <span>1</span>
              <span>5</span>
              <span>9</span>
            </div>
          </div>

          {/* Emoticon row for visual reference */}
          <div className="flex justify-center gap-1 py-2 bg-gray-50 rounded-xl">
            {EFFORT_SCALE.map((item) => (
              <button
                key={item.value}
                onClick={() => setSelectedScore(item.value)}
                onMouseEnter={() => setHoveredScore(item.value)}
                onMouseLeave={() => setHoveredScore(null)}
                className={`
                  text-2xl p-1 rounded-lg transition-all duration-150
                  ${selectedScore === item.value
                    ? 'bg-indigo-100 scale-125'
                    : 'hover:bg-gray-100 hover:scale-110 opacity-70 hover:opacity-100'
                  }
                `}
                title={`${item.value}: ${item.label}`}
              >
                {item.emoji}
              </button>
            ))}
          </div>

          {/* Description of selected level */}
          {selectedScore && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <div className="text-sm text-indigo-600 font-medium">
                You selected: <span className="font-bold">{selectedScore}</span> - {EFFORT_SCALE[selectedScore - 1].label}
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={selectedScore === null}
            className={`
              w-full py-4 rounded-xl font-bold text-lg transition-all
              ${selectedScore !== null
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {selectedScore !== null ? 'Continue to Next Paragraph' : 'Please select a rating'}
          </button>
        </div>

        {/* Info box */}
        <div className="text-center text-xs text-gray-500">
          <p>This helps us understand how challenging the reading task was for you.</p>
          <p className="mt-1">Your response is confidential and won't affect your score.</p>
        </div>
      </div>
    </div>
  )
}
