import { XCircle, CheckCircle, ArrowRight } from 'lucide-react';

type Props = {
  word: string;
  definition: string;
  onContinue: () => void;
};

export default function CorrectAnswerModal({ word, definition, onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center justify-center gap-2">
            <XCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-2xl font-bold text-red-700">Incorrect</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Correct spelling */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">The correct spelling is:</p>
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 border-2 border-green-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-700 tracking-wide">
                {word.toUpperCase()}
              </span>
            </div>
          </div>

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
