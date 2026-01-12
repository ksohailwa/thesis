type DefinitionResult = {
  word: string
  correct: boolean | null
  feedback: string
}

type DefinitionFeedbackViewProps = {
  results: DefinitionResult[] | null
  onContinue: () => void
}

export default function DefinitionFeedbackView({
  results,
  onContinue,
}: DefinitionFeedbackViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">
            Definition feedback
          </h2>
          <p className="text-sm text-gray-600">
            Scores are shown after the final definitions.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          {(results || []).map((r) => (
            <div key={r.word} className="border rounded-lg p-3">
              <div className="font-semibold text-gray-800">{r.word}</div>
              <div
                className={`text-sm ${
                  r.correct
                    ? 'text-green-700'
                    : r.correct === false
                      ? 'text-red-700'
                      : 'text-gray-600'
                }`}
              >
                {r.feedback || 'No feedback available.'}
              </div>
            </div>
          ))}
          {(!results || results.length === 0) && (
            <div className="text-sm text-gray-600">Feedback unavailable.</div>
          )}
          <button onClick={onContinue} className="w-full btn primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
