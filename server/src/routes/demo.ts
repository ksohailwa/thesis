import { Router } from 'express';
import { Experiment } from '../models/Experiment';

const router = Router();

// List recent experiments for the Demo screen
router.get('/demo', async (_req, res) => {
  const list = await Experiment.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select('_id title level targetWords');
  const items = list.map((e) => ({
    id: String(e._id),
    title: e.title,
    level: e.level,
    targetWordsCount: (e.targetWords || []).length,
    description: '',
  }));
  res.json(items);
});

// Lightweight demo join endpoint that does not depend on DB writes
router.post('/demo/join', async (_req, res) => {
  const demoId = 'demo-exp-1';
  const level = 'B1';
  const targetWords = ['castle', 'rhythm', 'embarrass', 'separate'];
  const stories = {
    A: {
      paragraphs: [
        'In a small village, there was a tall **castle** on a hill. Children often mis-spelled **castle** when they wrote stories. Their teacher drew the **castle** on the board and underlined each letter in **castle** to help them remember.',
        'Music class was about the word **rhythm**. The students clapped to feel the **rhythm** and wrote the word **rhythm** slowly. Even when they were tired, they whispered **rhythm** to keep the beat.',
        'One day, a student wrote a story about how easy it is to **embarrass** yourself. She typed **embarrass** correctly, then checked the spelling of **embarrass** again.',
        'Another group worked on the word **separate**. They wrote that it is hard to **separate** the colours in paint. Their notes said, “never **separate** friends in a game,” and they circled **separate** at the top.',
        'At the end of class, the teacher asked them to read all four words—**castle**, **rhythm**, **embarrass**, and **separate**—before they left.',
      ],
    },
    B: {
      paragraphs: [
        'During a spelling club, students created a story about a **castle** near a river. They wrote **castle** on cards and placed the cards around a drawing of the **castle**. One student said that writing **castle** again helped fix the word in her memory.',
        'Later they turned on music with a slow **rhythm**. They walked around the room in time with the **rhythm**, chanting **rhythm** quietly. A poster on the wall showed the letters of **rhythm** in big print.',
        'For practice, they shared moments that could **embarrass** them, then spelled **embarrass** together. The leader erased and rewrote **embarrass** on the board until everyone remembered it.',
        'Finally, they split the tasks to **separate** their work. One student would **separate** the flashcards, and another would explain why we should not **separate** important ideas in a story. They underlined **separate** three times.',
        'They ended by reviewing the list—**castle**, **rhythm**, **embarrass**, and **separate**—promising to notice each word four times in their writing.',
      ],
    },
  };

  // Simple baseline schedule: put each word in paragraph 0/1/2/3 of story A
  const schedule: Record<string, any> = {};
  targetWords.forEach((w, idx) => {
    schedule[w] = {
      baseline: { story: 'A', paragraphIndex: 0, sentenceIndex: 0 },
      learning: { story: 'A', paragraphIndex: 1, sentenceIndex: 0 },
      reinforcement: { story: 'A', paragraphIndex: 2, sentenceIndex: 0 },
      recall: { story: 'A', paragraphIndex: 3, sentenceIndex: 0 },
    };
  });

  return res.json({
    experiment: {
      id: demoId,
      title: 'Demo Spelling Story',
      description: 'Sample demo experiment',
      level,
      targetWords,
    },
    condition: 'with-hints',
    stories,
    schedule,
  });
});

export default router;
