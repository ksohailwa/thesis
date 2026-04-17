import { useState, useMemo, useRef } from 'react';
import { Shuffle, CheckCircle, XCircle, RotateCcw, Volume2 } from 'lucide-react';

type Props = {
  word: string;
  audioUrl?: string | null;
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

export default function JumbleExercise({ word, audioUrl, onComplete, onAttempt }: Props) {
  const originalLetters = useMemo(() => shuffleLetters(word), [word]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const base = import.meta.env.VITE_API_BASE_URL || '';

  const [availableLetters, setAvailableLetters] = useState<{ letter: string; id: number }[]>(
    originalLetters.map((l, i) => ({ letter: l, id: i }))
  );
  const [selectedLetters, setSelectedLetters] = useState<{ letter: string; id: number }[]>([]);
  const [lockedPositions, setLockedPositions] = useState<Set<number>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const playAudio = () => {
    if (!audioUrl || !audioRef.current) return;
    const src = audioUrl.startsWith('http') ? audioUrl : `${base}${audioUrl}`;
    audioRef.current.src = src;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  const handleSelectLetter = (item: { letter: string; id: number }) => {
    if (showResult) return;
    setAvailableLetters((prev) => prev.filter((l) => l.id !== item.id));
    setSelectedLetters((prev) => [...prev, item]);
  };

  const handleRemoveLetter = (item: { letter: string; id: number }, index: number) => {
    if (showResult) return;
    // Don't allow removing locked letters
    if (lockedPositions.has(index)) return;

    setSelectedLetters((prev) => prev.filter((l) => l.id !== item.id));
    setAvailableLetters((prev) => [...prev, item]);
  };

  const handleReset = () => {
    // Only reset non-locked letters
    const lockedLetters = selectedLetters.filter((_, i) => lockedPositions.has(i));
    const unlockedLetters = selectedLetters.filter((_, i) => !lockedPositions.has(i));

    // Return unlocked letters to available
    setAvailableLetters((prev) => [...prev, ...unlockedLetters]);
    setSelectedLetters(lockedLetters);
    setShowResult(false);
    setIsCorrect(false);
  };

  const handleFullReset = () => {
    setAvailableLetters(originalLetters.map((l, i) => ({ letter: l, id: i })));
    setSelectedLetters([]);
    setLockedPositions(new Set());
    setShowResult(false);
    setIsCorrect(false);
    setAttemptCount(0);
  };

  const handleCheck = () => {
    const arrangement = selectedLetters.map((l) => l.letter).join('');
    const correct = arrangement.toLowerCase() === word.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);
    setAttemptCount((c) => c + 1);
    onAttempt(arrangement, correct);

    if (correct) {
      setTimeout(() => {
        onComplete();
      }, 1000);
    } else {
      // Lock letters that are in the correct position
      const newLockedPositions = new Set<number>();
      const correctLetters = word.toLowerCase().split('');

      selectedLetters.forEach((item, index) => {
        if (item.letter.toLowerCase() === correctLetters[index]) {
          newLockedPositions.add(index);
        }
      });

      setLockedPositions(newLockedPositions);

      // Re-shuffle available letters after incorrect attempt
      setTimeout(() => {
        setAvailableLetters((prev) => {
          const shuffled = [...prev];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        });
      }, 500);
    }
  };

  const handleRetry = () => {
    // Keep locked letters in place, reset others
    const lockedLetters: { letter: string; id: number }[] = [];
    const unlockedLetters: { letter: string; id: number }[] = [];

    selectedLetters.forEach((item, index) => {
      if (lockedPositions.has(index)) {
        lockedLetters.push(item);
      } else {
        unlockedLetters.push(item);
      }
    });

    // Rebuild selected with locked letters in place, unlocked go back to available
    setSelectedLetters(lockedLetters);
    setAvailableLetters((prev) => [...prev, ...unlockedLetters]);
    setShowResult(false);
    setIsCorrect(false);
  };

  // Get letter style based on position and state
  const getLetterStyle = (index: number, isLocked: boolean) => {
    if (showResult) {
      const correctLetter = word.toLowerCase()[index];
      const currentLetter = selectedLetters[index]?.letter.toLowerCase();

      if (currentLetter === correctLetter) {
        return 'bg-green-500 text-white ring-2 ring-green-300';
      } else {
        return 'bg-red-400 text-white';
      }
    }

    if (isLocked) {
      return 'bg-green-500 text-white cursor-not-allowed';
    }

    return 'bg-purple-500 text-white hover:bg-purple-600 hover:scale-105 active:scale-95 cursor-pointer';
  };

  const lockedCount = lockedPositions.size;
  const totalLetters = word.length;

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

        {/* Progress indicator */}
        {lockedCount > 0 && (
          <div className="mt-2 text-sm text-green-600 font-medium">
            {lockedCount} of {totalLetters} letters correct!
          </div>
        )}
      </div>

      {/* Audio button */}
      {audioUrl && (
        <div className="flex justify-center">
          <button
            onClick={playAudio}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-all font-medium"
          >
            <Volume2 className="w-5 h-5" />
            Listen to the word
          </button>
        </div>
      )}

      {/* Selected letters (answer area) */}
      <div className="min-h-[80px] p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <p className="text-xs text-gray-400 mb-2">Your arrangement:</p>
        <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
          {selectedLetters.length === 0 ? (
            <span className="text-gray-400 italic">Click letters below to start</span>
          ) : (
            <>
              {/* Show placeholders for the full word length */}
              {Array.from({ length: word.length }).map((_, index) => {
                const item = selectedLetters[index];
                const isLocked = lockedPositions.has(index);

                if (!item) {
                  // Empty slot
                  return (
                    <div
                      key={`slot-${index}`}
                      className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                    >
                      <span className="text-gray-300 text-xs">{index + 1}</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleRemoveLetter(item, index)}
                    disabled={showResult || isLocked}
                    className={`w-10 h-10 rounded-lg font-bold text-lg flex items-center justify-center transition-all ${getLetterStyle(index, isLocked)}`}
                    title={isLocked ? 'Correct! This letter is locked.' : 'Click to remove'}
                  >
                    {item.letter.toUpperCase()}
                    {isLocked && !showResult && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </>
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
                disabled={showResult || selectedLetters.length >= word.length}
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
              <div>
                <p className="font-semibold">Not quite right.</p>
                <p className="text-sm">Green letters are correct and locked. Rearrange the others!</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={lockedPositions.size > 0 ? handleReset : handleFullReset}
          disabled={showResult && isCorrect}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          {lockedPositions.size > 0 ? 'Reset Wrong' : 'Reset'}
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

      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
