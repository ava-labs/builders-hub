'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import posthog from 'posthog-js';

type Rating = 'positive' | 'negative' | null;
type FeedbackCategory = 'incorrect' | 'incomplete' | 'confusing' | 'other';

interface FeedbackProps {
  messageId: string;
  sessionId?: string;
  className?: string;
}

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'confusing', label: 'Confusing' },
  { value: 'other', label: 'Other' },
];

export function MessageFeedback({ messageId, sessionId, className }: FeedbackProps) {
  const [rating, setRating] = useState<Rating>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRating = (newRating: Rating) => {
    setRating(newRating);

    // Track the rating event
    posthog.capture('ai_response_rated', {
      rating: newRating,
      messageId,
      sessionId,
    });

    if (newRating === 'negative') {
      setShowCategoryPicker(true);
    } else {
      // Positive feedback is complete
      setSubmitted(true);
    }
  };

  const handleCategorySelect = (category: FeedbackCategory) => {
    setSelectedCategory(category);
  };

  const handleSubmitFeedback = () => {
    posthog.capture('ai_feedback_submitted', {
      rating,
      category: selectedCategory,
      comment: comment.trim() || undefined,
      messageId,
      sessionId,
    });

    setSubmitted(true);
    setShowCategoryPicker(false);
  };

  const handleDismiss = () => {
    setShowCategoryPicker(false);
    setSubmitted(true);
  };

  // Already submitted - show thank you
  if (submitted) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  // Show category picker for negative feedback
  if (showCategoryPicker) {
    return (
      <div className={cn("space-y-3 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">What went wrong?</span>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Category buttons */}
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategorySelect(cat.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                selectedCategory === cat.value
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700"
                  : "bg-zinc-200 dark:bg-zinc-700 text-muted-foreground hover:bg-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Optional comment */}
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional details (optional)"
            className={cn(
              "w-full px-3 py-2 text-sm rounded-lg resize-none",
              "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
              "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            )}
            rows={2}
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmitFeedback}
          disabled={!selectedCategory}
          className={cn(
            "flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium rounded-lg transition-all",
            selectedCategory
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
              : "bg-zinc-200 dark:bg-zinc-700 text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
          Submit Feedback
        </button>
      </div>
    );
  }

  // Default state - show thumbs buttons
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground/60 mr-1">Was this helpful?</span>
      <button
        onClick={() => handleRating('positive')}
        className={cn(
          "p-1.5 rounded-md transition-all",
          rating === 'positive'
            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
            : "text-muted-foreground/50 hover:text-green-600 dark:hover:text-green-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        )}
        title="Helpful"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleRating('negative')}
        className={cn(
          "p-1.5 rounded-md transition-all",
          rating === 'negative'
            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "text-muted-foreground/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        )}
        title="Not helpful"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}
