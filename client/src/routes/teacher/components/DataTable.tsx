type Column<T> = {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

type DataTableProps<T> = {
  data: T[]
  columns: Column<T>[]
  emptyMessage?: string
  getKey: (item: T) => string
}

export default function DataTable<T>({
  data,
  columns,
  emptyMessage = 'No data available.',
  getKey,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
            {columns.map((col) => (
              <th key={col.key} className={`p-3 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={getKey(item)} className="border-b hover:bg-gray-50 text-sm">
              {columns.map((col) => (
                <td key={col.key} className={`p-3 ${col.className || ''}`}>
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
