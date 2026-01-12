import type { FiltersState } from '../analyticsTypes'

type FilterPanelProps = {
  filters: FiltersState
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>
  onApply: () => void
  onReset: () => void
}

export default function FilterPanel({ filters, setFilters, onApply, onReset }: FilterPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm text-gray-600">
          From
          <input
            type="date"
            className="input mt-1"
            value={filters.from}
            onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
          />
        </label>
        <label className="text-sm text-gray-600">
          To
          <input
            type="date"
            className="input mt-1"
            value={filters.to}
            onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
          />
        </label>
        <label className="text-sm text-gray-600">
          Story
          <select
            className="input mt-1"
            value={filters.story}
            onChange={(e) => setFilters((s) => ({ ...s, story: e.target.value }))}
          >
            <option value="">All</option>
            <option value="A">Story A</option>
            <option value="B">Story B</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Condition
          <select
            className="input mt-1"
            value={filters.condition}
            onChange={(e) => setFilters((s) => ({ ...s, condition: e.target.value }))}
          >
            <option value="">All</option>
            <option value="with-hints">With Hints</option>
            <option value="without-hints">Without Hints</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn primary px-5 py-2" onClick={onApply}>
          Apply Filters
        </button>
        <button
          className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
