import { XCircle, CheckCircle, ArrowRight } from 'lucide-react';

type Props = {
  word: string;
  definition: string;
  studentAttempt: string;
  onContinue: () => void;
};

export default function CorrectAnswerModal({ word, definition, studentAttempt, onContinue }: Props) {
  // Highlight differences between attempt and correct word
  const renderComparison = () => {
    const correct = word.toLowerCase();
    const attempt = studentAttempt.toLowerCase();

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* Student's attempt */}
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Your spelling:</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-200 rounded-xl">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xl font-bold text-red-600 tracking-wide line-through decoration-2">
              {studentAttempt.toUpperCase() || '(empty)'}
            </span>
          </div>
        </div>

        <ArrowRight className="w-6 h-6 text-gray-400 hidden sm:block" />
        <span className="text-gray-400 sm:hidden">vs</span>

        {/* Correct spelling */}
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Correct spelling:</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border-2 border-green-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xl font-bold text-green-700 tracking-wide">
              {word.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center justify-center gap-2">
            <XCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-2xl font-bold text-red-700">Incorrect</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Comparison */}
          {renderComparison()}

          {/* Definition */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Definition
            </p>
            <p className="text-gray-700">{definition}</p>
          </div>

          {/* Continue button */}
          <button
            onClick={onContinue}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
