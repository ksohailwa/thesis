import { useState } from 'react'

type Props = {
  open: boolean
  targetWords: string[]
  onSubmit: (answers: { word: string; definition: string }[]) => Promise<void>
  onClose: () => void
  allowClose?: boolean
}

export default function DefineModal({ open, targetWords, onSubmit, onClose, allowClose = true }: Props) {
  const [defs, setDefs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  if (!open) return null

  const words = targetWords || []

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit(words.map(w => ({ word: w, definition: defs[w] || '' })))
      setDefs({})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Define the target words</h3>
          {allowClose && (
            <button className="text-sm text-gray-500 hover:text-gray-700" onClick={onClose}>Close</button>
          )}
        </div>
        <p className="text-sm text-gray-600">Write a short definition for each word. Partial meanings are OK.</p>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {words.map((w) => (
            <div key={w} className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">{w}</label>
              <textarea
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={defs[w] || ''}
                onChange={e => setDefs(d => ({ ...d, [w]: e.target.value }))}
                placeholder="Your definition"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full btn primary disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit definitions'}
        </button>
      </div>
    </div>
  )
}
