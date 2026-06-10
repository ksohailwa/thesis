import { useEffect, useState } from 'react';
import { X, Target } from 'lucide-react';
import { useIntervention } from '../../../store/intervention';
import MCQExercise from './exercises/MCQExercise';
import JumbleExercise from './exercises/JumbleExercise';
import api from '../../../lib/api';

type Props = {
  onComplete: () => void;
};

export default function InterventionPopup({ onComplete }: Props) {
  const {
    isActive,
    interventionId,
    targetWord,
    wordMetadata,
    currentExercise,
    mcqCompleted,
    jumbleCompleted,
    completeMCQ,
    completeJumble,
    finishIntervention,
  } = useIntervention();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if the enabled exercises are done. Sentence formation is hidden for now.
  useEffect(() => {
    if (mcqCompleted && jumbleCompleted && interventionId) {
      handleCompleteIntervention();
    }
  }, [mcqCompleted, jumbleCompleted, interventionId]);

  const handleCompleteIntervention = async () => {
    if (!interventionId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.post('api/student/intervention/complete', { interventionId });
      finishIntervention();
      onComplete();
    } catch (error) {
      console.error('Failed to complete intervention:', error);
      // Still complete locally
      finishIntervention();
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  // MCQ handlers
  const handleMCQAttempt = async (selectedAnswer: string, isCorrect: boolean) => {
    if (!interventionId || !wordMetadata) return;

    try {
      await api.post('api/student/intervention/mcq', {
        interventionId,
        selectedAnswer,
        correctAnswer: wordMetadata.definition,
      });
    } catch (error) {
      console.error('Failed to submit MCQ attempt:', error);
    }
  };

  const handleMCQComplete = () => {
    completeMCQ();
  };

  // Jumble handlers
  const handleJumbleAttempt = async (arrangement: string, isCorrect: boolean) => {
    if (!interventionId || !targetWord) return;

    try {
      await api.post('api/student/intervention/jumble', {
        interventionId,
        arrangement,
        targetWord,
      });
    } catch (error) {
      console.error('Failed to submit jumble attempt:', error);
    }
  };

  const handleJumbleComplete = () => {
    completeJumble();
  };

  if (!isActive || !targetWord || !wordMetadata) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              <h2 className="text-lg font-bold">Let's Practice!</h2>
            </div>
            <div className="text-sm opacity-80">
              Exercise {Math.min(currentExercise, 2)}/2
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step < currentExercise || (step === 1 && mcqCompleted) || (step === 2 && jumbleCompleted)
                      ? 'bg-green-400 text-white'
                      : step === currentExercise
                        ? 'bg-white text-purple-600'
                        : 'bg-white/30 text-white/60'
                  }`}
                >
                  {(step === 1 && mcqCompleted) || (step === 2 && jumbleCompleted)
                    ? '✓'
                    : step}
                </div>
                {step < 2 && (
                  <div
                    className={`w-8 h-1 mx-1 rounded ${
                      step === 1 && mcqCompleted
                        ? 'bg-green-400'
                        : 'bg-white/30'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 mt-2 text-xs opacity-80">
            <span>Definition</span>
            <span>Spelling</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentExercise === 1 && !mcqCompleted && (
            <MCQExercise
              word={targetWord}
              correctDefinition={wordMetadata.definition}
              distractorDefinitions={wordMetadata.distractorDefinitions}
              exampleSentence={wordMetadata.exampleSentences?.[0]}
              onComplete={handleMCQComplete}
              onAttempt={handleMCQAttempt}
            />
          )}

          {currentExercise === 2 && mcqCompleted && !jumbleCompleted && (
            <JumbleExercise
              word={targetWord}
              audioUrl={wordMetadata.audioUrl}
              onComplete={handleJumbleComplete}
              onAttempt={handleJumbleAttempt}
            />
          )}

          {/* Completion state */}
          {mcqCompleted && jumbleCompleted && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">All Done!</h3>
              <p className="text-gray-600">
                Great job completing both exercises!
              </p>
              {isSubmitting && (
                <p className="text-sm text-gray-400 mt-4">Saving progress...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
