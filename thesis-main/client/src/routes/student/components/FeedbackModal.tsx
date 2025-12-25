type Props = {
  feedbackData: { difficulty: number; effort: string }
  setFeedbackData: any
  submitFeedback: () => void
  submitting: boolean
  storyIndex: number
}

export default function FeedbackModal({
  feedbackData,
  setFeedbackData,
  submitFeedback,
  submitting,
  storyIndex
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 bg-purple-50 border-b border-purple-100">
          <h2 className="text-2xl font-bold text-purple-900 text-center">Great Job!</h2>
          <p className="text-center text-purple-600 mt-1">How did that feel?</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Difficulty</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => setFeedbackData((f: any) => ({ ...f, difficulty: v }))}
                  className={`flex-1 h-10 rounded-lg font-bold transition ${
                    feedbackData.difficulty === v ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Too Easy</span>
              <span>Too Hard</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Effort</label>
            <div className="grid grid-cols-3 gap-2">
              {['low', 'medium', 'high'].map(e => (
                <button
                  key={e}
                  onClick={() => setFeedbackData((f: any) => ({ ...f, effort: e }))}
                  className={`h-10 rounded-lg text-sm font-medium capitalize transition ${
                    feedbackData.effort === e ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={submitFeedback}
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? 'Saving...' : (storyIndex === 0 ? 'Next Story' : 'Start Recall Test')}
          </button>
        </div>
      </div>
    </div>
  )
}
