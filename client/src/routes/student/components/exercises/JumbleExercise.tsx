import { useState, useMemo } from 'react';
import { Shuffle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

type Props = {
  word: string;
  onComplete: () => void;
  onAttempt: (arrangement: string, isCorrect: boolean) => void;
};

// Shuffle letters ensuring it's not the correct word
function shuffleLetters(word: string): string[] {
  const letters = word.split('');
  let shuffled: string[];
  let attempts = 0;

  do {
    shuffled = [...letters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (shuffled.join('').toLowerCase() === word.toLowerCase() && attempts < 10);

  return shuffled;
}

export default function JumbleExercise({ word, onComplete, onAttempt }: Props) {
  const originalLetters = useMemo(() => shuffleLetters(word), [word]);

  const [availableLetters, setAvailableLetters] = useState<{ letter: string; id: number }[]>(
    originalLetters.map((l, i) => ({ letter: l, id: i }))
  );
  const [selectedLetters, setSelectedLetters] = useState<{ letter: string; id: number }[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSelectLetter = (item: { letter: string; id: number }) => {
    if (showResult) return;
    setAvailableLetters((prev) => prev.filter((l) => l.id !== item.id));
    setSelectedLetters((prev) => [...prev, item]);
  };

  const handleRemoveLetter = (item: { letter: string; id: number }) => {
    if (showResult) return;
    setSelectedLetters((prev) => prev.filter((l) => l.id !== item.id));
    setAvailableLetters((prev) => [...prev, item]);
  };

  const handleReset = () => {
    setAvailableLetters(originalLetters.map((l, i) => ({ letter: l, id: i })));
    setSelectedLetters([]);
    setShowResult(false);
    setIsCorrect(false);
  };

  const handleCheck = () => {
    const arrangement = selectedLetters.map((l) => l.letter).join('');
    const correct = arrangement.toLowerCase() === word.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);
    onAttempt(arrangement, correct);

    if (correct) {
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  const handleRetry = () => {
    handleReset();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-3">
          <Shuffle className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Exercise 2: Unscramble</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800">Arrange the letters to spell the word</h3>
        <p className="text-sm text-gray-500 mt-1">Click letters to move them</p>
      </div>

      {/* Selected letters (answer area) */}
      <div className="min-h-[60px] p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <p className="text-xs text-gray-400 mb-2">Your arrangement:</p>
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
          {selectedLetters.length === 0 ? (
            <span className="text-gray-400 italic">Click letters below to start</span>
          ) : (
            selectedLetters.map((item) => (
              <button
                key={item.id}
                onClick={() => handleRemoveLetter(item)}
                disabled={showResult}
                className={`w-10 h-10 rounded-lg font-bold text-lg flex items-center justify-center transition-all ${
                  showResult
                    ? isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-400 text-white'
                    : 'bg-purple-500 text-white hover:bg-purple-600 hover:scale-105 active:scale-95'
                }`}
              >
                {item.letter.toUpperCase()}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Available letters */}
      <div className="p-3 bg-white rounded-xl border border-gray-200">
        <p className="text-xs text-gray-400 mb-2">Available letters:</p>
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
          {availableLetters.length === 0 ? (
            <span className="text-gray-400 italic">All letters used</span>
          ) : (
            availableLetters.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectLetter(item)}
                disabled={showResult}
                className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-gray-300 font-bold text-lg text-gray-700 flex items-center justify-center hover:bg-purple-100 hover:border-purple-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {item.letter.toUpperCase()}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Result message */}
      {showResult && (
        <div
          className={`p-4 rounded-xl text-center flex items-center justify-center gap-2 ${
            isCorrect ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}
        >
          {isCorrect ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <p className="font-semibold">Perfect! Moving to next exercise...</p>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5" />
              <p className="font-semibold">Not quite right. Try arranging the letters again!</p>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleReset}
          disabled={showResult && isCorrect}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>

        {!showResult ? (
          <button
            onClick={handleCheck}
            disabled={selectedLetters.length !== word.length}
            className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            Check Spelling
          </button>
        ) : !isCorrect ? (
          <button
            onClick={handleRetry}
            className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            Try Again
          </button>
        ) : null}
      </div>
    </div>
  );
}
