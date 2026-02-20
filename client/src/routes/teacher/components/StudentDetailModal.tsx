import { useState } from 'react'
import type { StudentDetail } from '../analyticsTypes'

type StudentDetailModalProps = {
  studentDetail: StudentDetail | null
  loading: boolean
  experimentId: string
  onClose: () => void
  onDownloadCsv: (url: string, filename: string) => void
  buildQuery: () => string
}

export default function StudentDetailModal({
  studentDetail,
  loading,
  experimentId,
  onClose,
  onDownloadCsv,
  buildQuery,
}: StudentDetailModalProps) {
  const [wordSort, setWordSort] = useState<'word' | 'attempts' | 'accuracy'>('attempts')
  const [wordOrder, setWordOrder] = useState<'asc' | 'desc'>('desc')

  const studentWordMax = Math.max(1, ...(studentDetail?.words || []).map((w) => w.attempts))
  const studentTimelineMax = Math.max(1, ...(studentDetail?.timeline || []).map((t) => t.attempts))
  const studentTimelineAccuracyMax = 100

  const sortedStudentWords = (studentDetail?.words || []).slice().sort((a, b) => {
    const dir = wordOrder === 'asc' ? 1 : -1
    if (wordSort === 'word') return a.word.localeCompare(b.word) * dir
    if (wordSort === 'accuracy') return (a.accuracy - b.accuracy) * dir
    return (a.attempts - b.attempts) * dir
  })

  const selectedStudentId = studentDetail?.student?.studentId

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto border border-gray-200 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Student Analytics</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
            Close
          </button>
        </div>
        {loading ? (
          <p className="text-center text-gray-600">Loading...</p>
        ) : studentDetail?.student ? (
          <div className="space-y-6 text-gray-800">
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                onClick={() =>
                  onDownloadCsv(
                    `api/analytics/experiment/${experimentId}/student/${selectedStudentId}/csv?type=summary${buildQuery().replace('?', '&')}`,
                    `experiment_${experimentId}_student_${selectedStudentId}_summary.csv`
                  )
                }
              >
                Summary CSV
              </button>
              <button
                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                onClick={() =>
                  onDownloadCsv(
                    `api/analytics/experiment/${experimentId}/student/${selectedStudentId}/csv?type=words${buildQuery().replace('?', '&')}`,
                    `experiment_${experimentId}_student_${selectedStudentId}_words.csv`
                  )
                }
              >
                Words CSV
              </button>
              <button
                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                onClick={() =>
                  onDownloadCsv(
                    `api/analytics/experiment/${experimentId}/student/${selectedStudentId}/csv?type=timeline${buildQuery().replace('?', '&')}`,
                    `experiment_${experimentId}_student_${selectedStudentId}_timeline.csv`
                  )
                }
              >
                Timeline CSV
              </button>
            </div>

            <div>
              <div className="text-lg font-semibold">{studentDetail.student.username}</div>
              <div className="text-sm text-gray-600">
                Condition: {studentDetail.student.condition}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Attempts', value: studentDetail.student.attempts },
                { label: 'Accuracy', value: `${studentDetail.student.accuracy}%` },
                { label: 'Hints', value: studentDetail.student.hints },
                { label: 'Definition Accuracy', value: `${studentDetail.student.definitionAccuracy}%` },
                { label: 'Recall Avg', value: studentDetail.student.recallAvg },
                { label: 'Time on Task (min)', value: studentDetail.student.timeOnTaskMin ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">{stat.label}</div>
                  <div className="text-lg font-semibold">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(['A', 'B'] as const).map((story) => (
                <div key={story} className="rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-600">Story {story}</div>
                  <div className="font-semibold text-gray-900">
                    Attempts: {studentDetail.byStory[story].attempts} | Accuracy:{' '}
                    {studentDetail.byStory[story].accuracy}%
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Word Performance</h4>
                <div className="flex items-center gap-2 text-xs">
                  <select
                    className="border border-gray-200 rounded px-2 py-1"
                    value={wordSort}
                    onChange={(e) => setWordSort(e.target.value as any)}
                  >
                    <option value="attempts">Sort by Attempts</option>
                    <option value="accuracy">Sort by Accuracy</option>
                    <option value="word">Sort by Word</option>
                  </select>
                  <select
                    className="border border-gray-200 rounded px-2 py-1"
                    value={wordOrder}
                    onChange={(e) => setWordOrder(e.target.value as any)}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
              {studentDetail.words.length === 0 ? (
                <p className="text-sm text-gray-500">No word activity.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                        <th className="p-2">Word</th>
                        <th className="p-2">Attempts</th>
                        <th className="p-2">Accuracy</th>
                        <th className="p-2">Accuracy Bar</th>
                        <th className="p-2">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudentWords.map((w) => (
                        <tr key={w.word} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium text-gray-900">{w.word}</td>
                          <td className="p-2 text-gray-600">{w.attempts}</td>
                          <td className="p-2 text-gray-600">{w.accuracy}%</td>
                          <td className="p-2">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-2 bg-emerald-500"
                                style={{ width: `${Math.min(100, w.accuracy)}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-2 bg-blue-500"
                                style={{
                                  width: `${Math.min(100, Math.round((w.attempts / studentWordMax) * 100))}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Timeline</h4>
              {studentDetail.timeline.length === 0 ? (
                <p className="text-sm text-gray-500">No timeline activity.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    {studentDetail.timeline.map((t) => (
                      <div key={t.day} className="flex flex-col items-center gap-1 w-10">
                        <div
                          className="w-6 rounded bg-indigo-500"
                          style={{
                            height: `${Math.max(6, Math.round((t.attempts / studentTimelineMax) * 80))}px`,
                          }}
                          title={`${t.attempts} attempts`}
                        />
                        <div
                          className="w-6 rounded bg-emerald-400"
                          style={{
                            height: `${Math.max(4, Math.round(((t.attempts ? (t.correct / t.attempts) * 100 : 0) / studentTimelineAccuracyMax) * 40))}px`,
                          }}
                          title={`${t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0}% accuracy`}
                        />
                        <span className="text-[10px] text-gray-500">{t.day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                          <th className="p-2">Day</th>
                          <th className="p-2">Attempts</th>
                          <th className="p-2">Correct</th>
                          <th className="p-2">Hints</th>
                          <th className="p-2">Definitions</th>
                          <th className="p-2">Recall</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentDetail.timeline.map((t) => (
                          <tr key={t.day} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium text-gray-900">{t.day}</td>
                            <td className="p-2 text-gray-600">{t.attempts}</td>
                            <td className="p-2 text-gray-600">{t.correct}</td>
                            <td className="p-2 text-gray-600">{t.hints}</td>
                            <td className="p-2 text-gray-600">{t.definitions}</td>
                            <td className="p-2 text-gray-600">{t.recall}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Common Misspellings</h4>
              {studentDetail.confusions.length === 0 ? (
                <p className="text-sm text-gray-500">No incorrect attempts logged.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                        <th className="p-2">Word</th>
                        <th className="p-2">Incorrect Attempts</th>
                        <th className="p-2">Top Misspellings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDetail.confusions.map((c) => (
                        <tr key={c.word} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium text-gray-900">{c.word}</td>
                          <td className="p-2 text-gray-600">{c.attempts}</td>
                          <td className="p-2 text-gray-600">
                            {c.topMisspellings.map((m) => `${m.text} (${m.count})`).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-600">No data available.</p>
        )}
      </div>
    </div>
  )
}
