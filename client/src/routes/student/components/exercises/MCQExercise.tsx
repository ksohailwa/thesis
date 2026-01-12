import { useState, useMemo } from 'react';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

type Props = {
  word: string;
  correctDefinition: string;
  distractorDefinitions: string[];
  onComplete: () => void;
  onAttempt: (selectedAnswer: string, isCorrect: boolean) => void;
};

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function MCQExercise({
  word,
  correctDefinition,
  distractorDefinitions,
  onComplete,
  onAttempt,
}: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Create shuffled options once
  const options = useMemo(() => {
    const allOptions = [correctDefinition, ...distractorDefinitions.slice(0, 3)];
    return shuffleArray(allOptions);
  }, [correctDefinition, distractorDefinitions]);

  const handleSelect = (option: string) => {
    if (showResult) return;
    setSelectedAnswer(option);
  };

  const handleCheck = () => {
    if (!selectedAnswer) return;

    const correct = selectedAnswer === correctDefinition;
    setIsCorrect(correct);
    setShowResult(true);
    onAttempt(selectedAnswer, correct);

    if (correct) {
      // Auto-advance after showing success
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  const handleRetry = () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
  };

  const getOptionStyle = (option: string) => {
    if (!showResult) {
      return selectedAnswer === option
        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
        : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/50';
    }

    if (option === correctDefinition) {
      return 'border-green-500 bg-green-50 ring-2 ring-green-200';
    }

    if (selectedAnswer === option && !isCorrect) {
      return 'border-red-500 bg-red-50 ring-2 ring-red-200';
    }

    return 'border-gray-200 bg-gray-50 opacity-50';
  };

  const getOptionIcon = (option: string) => {
    if (!showResult) {
      return selectedAnswer === option ? (
        <div className="w-5 h-5 rounded-full bg-purple-500" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
      );
    }

    if (option === correctDefinition) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }

    if (selectedAnswer === option && !isCorrect) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }

    return <div className="w-5 h-5 rounded-full border-2 border-gray-300 opacity-50" />;
  };

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full mb-3">
          <HelpCircle className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-700">Exercise 1: Definition Match</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800">
          What is the correct definition of the target word?
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(option)}
            disabled={showResult}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${getOptionStyle(option)}`}
          >
            <div className="mt-0.5">{getOptionIcon(option)}</div>
            <span className="text-gray-700 flex-1">{option}</span>
          </button>
        ))}
      </div>

      {/* Result message */}
      {showResult && (
        <div
          className={`p-4 rounded-xl text-center ${
            isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isCorrect ? (
            <p className="font-semibold">Correct! Moving to next exercise...</p>
          ) : (
            <p className="font-semibold">Not quite right. The correct answer is highlighted.</p>
          )}
        </div>
      )}

      {/* Action button */}
      <div className="pt-2">
        {!showResult ? (
          <button
            onClick={handleCheck}
            disabled={!selectedAnswer}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            Check Answer
          </button>
        ) : !isCorrect ? (
          <button
            onClick={handleRetry}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            Try Again
          </button>
        ) : null}
      </div>
    </div>
  );
}
