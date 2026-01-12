type DefinitionsViewProps = {
  targetParagraph: number
  definitionWords: string[]
  definitionDrafts: Record<string, string>
  setDefinitionDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSubmit: () => void
}

export default function DefinitionsView({
  targetParagraph,
  definitionWords,
  definitionDrafts,
  setDefinitionDrafts,
  onSubmit,
}: DefinitionsViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">Definitions</h2>
          <p className="text-sm text-gray-600">
            Paragraph {targetParagraph + 1}: write a short definition for each
            word.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          {definitionWords.map((w) => (
            <div key={w} className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">{w}</label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={definitionDrafts[w] || ''}
                onChange={(e) =>
                  setDefinitionDrafts((d) => ({ ...d, [w]: e.target.value }))
                }
                placeholder="Your definition"
              />
            </div>
          ))}
          {definitionWords.length === 0 && (
            <div className="text-sm text-gray-600">
              No words found for this paragraph.
            </div>
          )}
          <button onClick={onSubmit} className="w-full btn primary">
            Submit definitions
          </button>
        </div>
      </div>
    </div>
  )
}
