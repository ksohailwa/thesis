import { useState } from 'react'
import { Brain } from 'lucide-react'

type MentalEffortViewProps = {
  paragraphNumber: number
  onSubmit: (scores: { difficulty: number; effort: number }) => void
}

const SCALE = [1,2,3,4,5,6,7,8,9]

export default function MentalEffortView({
  paragraphNumber,
  onSubmit,
}: MentalEffortViewProps) {
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [effort, setEffort] = useState<number | null>(null)

  const handleSubmit = () => {
    if (difficulty !== null && effort !== null) {
      onSubmit({ difficulty, effort })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Perceived Difficulty */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-800">Perceived Difficulty</h3>
            <p className="text-sm text-gray-600">Paragraph {paragraphNumber}: How difficult was the task?</p>
          </div>
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>Very, very easy</span>
            <span>Very, very hard</span>
          </div>
          <div className="flex justify-center gap-2">
            {SCALE.map((v) => (
              <button
                key={`d-${v}`}
                onClick={() => setDifficulty(v)}
                className={`w-10 h-10 rounded-xl font-bold transition ${difficulty===v ? 'bg-indigo-600 text-white ring-4 ring-indigo-200' : 'bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700'}`}
              >{v}</button>
            ))}
          </div>
        </div>

        {/* Mental Effort */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-800">Mental Effort</h3>
            <p className="text-sm text-gray-600">Paragraph {paragraphNumber}: How hard did you have to think to do this task?</p>
          </div>
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>Very, very low</span>
            <span>Very, very high</span>
          </div>
          <div className="flex justify-center gap-2">
            {SCALE.map((v) => (
              <button
                key={`e-${v}`}
                onClick={() => setEffort(v)}
                className={`w-10 h-10 rounded-xl font-bold transition ${effort===v ? 'bg-purple-600 text-white ring-4 ring-purple-200' : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700'}`}
              >{v}</button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <button
            onClick={handleSubmit}
            disabled={difficulty===null || effort===null}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${difficulty!==null && effort!==null ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {difficulty!==null && effort!==null ? 'Continue' : 'Select both ratings'}
          </button>
        </div>
      </div>
    </div>
  )
}
