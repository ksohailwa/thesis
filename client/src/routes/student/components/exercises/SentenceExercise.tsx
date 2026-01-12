import { useState } from 'react';
import { PenLine, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

type Props = {
  targetWord: string;
  baseWord: string;
  exampleSentences: string[];
  onComplete: () => void;
  onAttempt: (sentence: string, isValid: boolean, feedback: string) => void;
};

// Mask word to show only first letter
function maskWord(word: string): string {
  if (word.length <= 1) return word;
  return word[0] + '_'.repeat(word.length - 1);
}

export default function SentenceExercise({
  targetWord,
  baseWord,
  exampleSentences,
  onComplete,
  onAttempt,
}: Props) {
  const [sentence, setSentence] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const maskedTargetWord = maskWord(targetWord);

  // Highlight words in sentence
  const getHighlightedSentence = () => {
    if (!sentence) return null;

    const lower = sentence.toLowerCase();
    const hasTarget = lower.includes(targetWord.toLowerCase());
    const hasBase = lower.includes(baseWord.toLowerCase());

    let result = sentence;

    // Simple highlighting - wrap matching words
    if (hasTarget) {
      const regex = new RegExp(`(${targetWord})`, 'gi');
      result = result.replace(regex, '<mark class="bg-purple-200 px-1 rounded">$1</mark>');
    }
    if (hasBase) {
      const regex = new RegExp(`(${baseWord})`, 'gi');
      result = result.replace(regex, '<mark class="bg-blue-200 px-1 rounded">$1</mark>');
    }

    return result;
  };

  const handleCheck = async () => {
    if (sentence.trim().length < 5) return;

    setIsChecking(true);

    // Simulate API call - in real implementation, this calls the backend
    try {
      const lower = sentence.toLowerCase();
      const hasTarget = lower.includes(targetWord.toLowerCase());
      const hasBase = lower.includes(baseWord.toLowerCase());
      const valid = hasTarget && hasBase && sentence.trim().length >= 10;

      setIsValid(valid);
      setFeedback(
        valid
          ? 'Great sentence! You used both words correctly.'
          : !hasTarget && !hasBase
            ? `Remember to use both the target word and "${baseWord}" in your sentence.`
            : !hasTarget
              ? `Don't forget to include the target word in your sentence.`
              : `Don't forget to include "${baseWord}" in your sentence.`
      );
      setShowResult(true);
      onAttempt(sentence, valid, feedback);

      if (valid) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetry = () => {
    setShowResult(false);
    setIsValid(false);
    setFeedback('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-3">
          <PenLine className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Exercise 3: Make a Sentence</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800">Write a sentence using both words</h3>
      </div>

      {/* Word chips */}
      <div className="flex justify-center gap-4">
        <div className="px-4 py-2 bg-purple-100 border-2 border-purple-300 rounded-full">
          <span className="text-sm text-purple-500">Target:</span>{' '}
          <span className="font-bold text-purple-700 tracking-wider">{maskedTargetWord}</span>
        </div>
        <div className="px-4 py-2 bg-blue-100 border-2 border-blue-300 rounded-full">
          <span className="text-sm text-blue-500">Use with:</span>{' '}
          <span className="font-bold text-blue-700">{baseWord}</span>
        </div>
      </div>

      {/* Hint toggle */}
      {exampleSentences.length > 0 && (
        <button
          onClick={() => setShowHint(!showHint)}
          className="w-full py-2 text-sm text-amber-600 hover:text-amber-700 flex items-center justify-center gap-1"
        >
          <Lightbulb className="w-4 h-4" />
          {showHint ? 'Hide example' : 'Show example for inspiration'}
        </button>
      )}

      {showHint && exampleSentences.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-600 font-semibold mb-1">Example:</p>
          <p className="text-sm text-amber-800 italic">"{exampleSentences[0]}"</p>
        </div>
      )}

      {/* Text input */}
      <div className="relative">
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          disabled={showResult && isValid}
          placeholder="Type your sentence here..."
          className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none h-32 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all disabled:bg-gray-50"
        />

        {/* Live preview with highlights */}
        {sentence && !showResult && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Preview:</p>
            <p
              className="text-gray-700"
              dangerouslySetInnerHTML={{ __html: getHighlightedSentence() || '' }}
            />
          </div>
        )}
      </div>

      {/* Word count indicator */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>{sentence.trim().split(/\s+/).filter(Boolean).length} words</span>
        <span>{sentence.length} characters</span>
      </div>

      {/* Result message */}
      {showResult && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 ${
            isValid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}
        >
          {isValid ? (
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold">{isValid ? 'Excellent!' : 'Keep trying!'}</p>
            <p className="text-sm mt-1">{feedback}</p>
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="pt-2">
        {!showResult ? (
          <button
            onClick={handleCheck}
            disabled={sentence.trim().length < 5 || isChecking}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isChecking ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking...
              </>
            ) : (
              'Check Sentence'
            )}
          </button>
        ) : !isValid ? (
          <button
            onClick={handleRetry}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            Try Again
          </button>
        ) : (
          <div className="text-center text-green-600 font-semibold py-3">
            Completing intervention...
          </div>
        )}
      </div>
    </div>
  );
}
