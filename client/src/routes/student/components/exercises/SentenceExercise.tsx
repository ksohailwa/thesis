import { useState, useMemo } from 'react';
import { PenLine, CheckCircle, XCircle, Lightbulb, RefreshCw } from 'lucide-react';
import api from '../../../../lib/api';

type Props = {
  targetWord: string;
  definition: string;
  companionWords: string[];
  exampleSentences: string[];
  interventionId: string;
  onComplete: () => void;
  onAttempt: (sentence: string, isValid: boolean, feedback: string) => void;
};

const MIN_WORD_COUNT = 5;

// Simple companion words that work with most target words
const DEFAULT_COMPANION_WORDS = [
  'always', 'never', 'often', 'really', 'very',
  'sometimes', 'usually', 'quickly', 'slowly', 'carefully'
];

export default function SentenceExercise({
  targetWord,
  definition,
  companionWords,
  exampleSentences,
  interventionId,
  onComplete,
  onAttempt,
}: Props) {
  const [sentence, setSentence] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [spellingErrorCount, setSpellingErrorCount] = useState(0);
  const [companionIndex, setCompanionIndex] = useState(0);

  // Filter out companion words that contain the target word
  const validCompanionWords = useMemo(() => {
    const targetLower = targetWord.toLowerCase();
    const filtered = companionWords.filter(
      (w) => !w.toLowerCase().includes(targetLower) && !targetLower.includes(w.toLowerCase())
    );
    // If no valid companions, use defaults
    if (filtered.length === 0) {
      return DEFAULT_COMPANION_WORDS;
    }
    return filtered;
  }, [companionWords, targetWord]);

  // Current companion word (changes after 2 spelling errors)
  const currentCompanionWord = validCompanionWords[companionIndex % validCompanionWords.length];

  // Check if target word is spelled correctly in sentence
  const checkTargetSpelling = (text: string): boolean => {
    const words = text.toLowerCase().split(/\s+/);
    return words.some((w) => {
      // Remove punctuation and check exact match
      const cleaned = w.replace(/[^a-z]/gi, '');
      return cleaned === targetWord.toLowerCase();
    });
  };

  // Highlight words in sentence
  const getHighlightedSentence = () => {
    if (!sentence) return null;

    const lower = sentence.toLowerCase();
    const hasTarget = lower.includes(targetWord.toLowerCase());
    const hasCompanion = lower.includes(currentCompanionWord.toLowerCase());

    let result = sentence;

    // Simple highlighting - wrap matching words
    if (hasTarget) {
      const regex = new RegExp(`(${targetWord})`, 'gi');
      result = result.replace(regex, '<mark class="bg-purple-200 px-1 rounded">$1</mark>');
    }
    if (hasCompanion) {
      const regex = new RegExp(`(${currentCompanionWord})`, 'gi');
      result = result.replace(regex, '<mark class="bg-blue-200 px-1 rounded">$1</mark>');
    }

    return result;
  };

  const handleCheck = async () => {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length < 5) return;

    // Pre-validation: count unique words
    const words = trimmedSentence.toLowerCase().split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map(w => w.replace(/[^a-z]/gi, '')).filter(w => w.length > 0));

    if (uniqueWords.size < MIN_WORD_COUNT) {
      setIsValid(false);
      setFeedback(`Your sentence needs at least ${MIN_WORD_COUNT} different words. You have ${uniqueWords.size}.`);
      setShowResult(true);
      return;
    }

    // Check if both words are present (quick local check before API)
    const lower = trimmedSentence.toLowerCase();
    const hasCompanion = lower.includes(currentCompanionWord.toLowerCase());
    const hasTargetCorrectSpelling = checkTargetSpelling(trimmedSentence);

    if (!hasTargetCorrectSpelling || !hasCompanion) {
      // Handle missing words locally for faster feedback
      if (!hasTargetCorrectSpelling && !hasCompanion) {
        setFeedback(`Remember to use both "${targetWord}" and "${currentCompanionWord}" in your sentence.`);
      } else if (!hasTargetCorrectSpelling) {
        // Check for misspelling
        const hasTargetMisspelled = lower.split(/\s+/).some((w) => {
          const cleaned = w.replace(/[^a-z]/gi, '');
          return cleaned.length >= 3 &&
                 targetWord.toLowerCase().startsWith(cleaned.slice(0, 2)) &&
                 cleaned !== targetWord.toLowerCase();
        });

        if (hasTargetMisspelled) {
          const newErrorCount = spellingErrorCount + 1;
          setSpellingErrorCount(newErrorCount);
          if (newErrorCount >= 2 && validCompanionWords.length > 1) {
            setCompanionIndex((prev) => prev + 1);
            setFeedback(`Check the spelling of "${targetWord}". Here's a new companion word to try with!`);
          } else {
            setFeedback(`Almost! Check the spelling of the target word. The correct spelling is: ${targetWord}`);
          }
        } else {
          setFeedback(`Don't forget to include the target word "${targetWord}" in your sentence.`);
        }
      } else {
        setFeedback(`Don't forget to include "${currentCompanionWord}" in your sentence.`);
      }
      setIsValid(false);
      setShowResult(true);
      return;
    }

    // Call API for LLM validation
    setIsChecking(true);

    try {
      const response = await api.post('api/student/intervention/sentence', {
        interventionId,
        sentence: trimmedSentence,
        targetWord,
        baseWord: currentCompanionWord,
      });

      const { isValid: valid, feedback: apiFeedback } = response.data;

      setIsValid(valid);
      setFeedback(apiFeedback || (valid ? 'Great sentence!' : 'Please write a more complete sentence.'));
      setShowResult(true);
      onAttempt(trimmedSentence, valid, apiFeedback);

      if (valid) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to validate sentence:', error);
      // Fallback to basic validation if API fails
      const valid = hasTargetCorrectSpelling && hasCompanion && uniqueWords.size >= MIN_WORD_COUNT;
      setIsValid(valid);
      setFeedback(valid ? 'Great sentence!' : 'Please write a more complete sentence with both words.');
      setShowResult(true);
      onAttempt(trimmedSentence, valid, feedback);

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

      {/* Target word with definition */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-purple-500 font-medium">Target word:</span>
          <span className="text-2xl font-bold text-purple-700 tracking-wide">{targetWord}</span>
        </div>
        {definition && (
          <p className="text-sm text-gray-600 italic">"{definition}"</p>
        )}
      </div>

      {/* Companion word */}
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-blue-100 border-2 border-blue-300 rounded-full flex items-center gap-2">
          <span className="text-sm text-blue-500">Use with:</span>
          <span className="font-bold text-blue-700">{currentCompanionWord}</span>
          {spellingErrorCount >= 2 && (
            <RefreshCw className="w-4 h-4 text-blue-500" />
          )}
        </div>
      </div>

      {/* Spelling error hint */}
      {spellingErrorCount > 0 && spellingErrorCount < 2 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
          <p className="text-sm text-amber-700">
            <span className="font-medium">Tip:</span> Make sure to spell "{targetWord}" correctly!
          </p>
        </div>
      )}

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
          placeholder={`Write a sentence using "${targetWord}" and "${currentCompanionWord}"...`}
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
