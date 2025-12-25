import { analyzeWordDifficulty, WordMetrics } from './wordAnalytics';

export interface SmartRecommendation {
  word: string;
  reason: string;
  score: number;
  pastDifficulty?: number;
}

export async function getSmartRecommendations(
  cefr: string,
  excludeWords: string[],
  teacherId: string
): Promise<SmartRecommendation[]> {
  const { Experiment } = await import('../models/Experiment');
  const pastExperiments = await Experiment.find({
    owner: teacherId,
    cefr,
    status: { $in: ['live', 'closed', 'archived'] },
  }).limit(10);

  if (pastExperiments.length === 0) return [];

  const allWords = new Set<string>();
  for (const exp of pastExperiments)
    (exp.targetWords || []).forEach((w: string) => allWords.add(w));

  const recommendations: SmartRecommendation[] = [];

  for (const word of allWords) {
    if (excludeWords.includes(word)) continue;

    const expIds = pastExperiments.map((e) => String(e._id));
    const allMetrics: WordMetrics[] = [];

    for (const expId of expIds) {
      const metrics = await analyzeWordDifficulty(expId, [word]);
      if (metrics.length) allMetrics.push(metrics[0]);
    }
    if (!allMetrics.length) continue;

    const avgDifficulty =
      allMetrics.reduce((sum, m) => sum + m.difficultyScore, 0) / allMetrics.length;
    const avgEngagement =
      100 - allMetrics.reduce((sum, m) => sum + m.revealRate, 0) / allMetrics.length;
    const difficultyBonus = Math.abs(avgDifficulty - 50) < 20 ? 20 : 0;
    const engagementBonus = avgEngagement * 0.5;
    const score = Math.round(difficultyBonus + engagementBonus);

    recommendations.push({
      word,
      reason: `Used ${allMetrics.length}x before (difficulty: ${Math.round(avgDifficulty)}/100)`,
      score,
      pastDifficulty: Math.round(avgDifficulty),
    });
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 10);
}
