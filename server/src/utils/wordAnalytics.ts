import { Attempt } from '../models/Attempt';

export interface WordMetrics {
  word: string;
  totalAttempts: number;
  avgScore: number;
  avgLatency: number;
  avgHintCount: number;
  revealRate: number;
  difficultyScore: number;
}

export async function analyzeWordDifficulty(experimentId: string, words: string[]): Promise<WordMetrics[]> {
  const metrics: WordMetrics[] = [];

  for (const word of words) {
    const attempts = await Attempt.find({
      experiment: experimentId,
      targetWord: word,
    });

    if (attempts.length === 0) {
      metrics.push({
        word,
        totalAttempts: 0,
        avgScore: 0,
        avgLatency: 0,
        avgHintCount: 0,
        revealRate: 0,
        difficultyScore: 50,
      });
      continue;
    }

    const totalAttempts = attempts.length;
    const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts;
    const avgLatency = attempts.reduce((sum, a) => sum + (a.latencyMsFirst || 0), 0) / totalAttempts;
    const avgHintCount = attempts.reduce((sum, a) => sum + a.hintCount, 0) / totalAttempts;
    const revealRate = attempts.filter((a) => a.revealed).length / totalAttempts;

    const difficultyScore = Math.round(
      (1 - avgScore) * 40 + revealRate * 30 + (avgHintCount / 3) * 20 + (avgLatency / 10000) * 10
    );

    metrics.push({
      word,
      totalAttempts,
      avgScore: Math.round(avgScore * 100) / 100,
      avgLatency: Math.round(avgLatency),
      avgHintCount: Math.round(avgHintCount * 10) / 10,
      revealRate: Math.round(revealRate * 100),
      difficultyScore: Math.min(100, Math.max(0, difficultyScore)),
    });
  }

  return metrics.sort((a, b) => b.difficultyScore - a.difficultyScore);
}
