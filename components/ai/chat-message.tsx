'use client';
import { type Message } from '@ai-sdk/react';
import { ChevronRight, HelpCircle, Loader2, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/use-mobile';
import { cn } from '../../lib/cn';
import { roleIcon, roleName, removeFollowUpQuestions, parseFollowUpQuestions, extractConsoleReferences } from './helpers';
import { Markdown } from './markdown';

// Simple loading component with realistic progression
const StreamingLoadingBlur = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const loadingSteps = [
    "Analyzing your question...",
    "Searching documentation...",
    "Crafting response..."
  ];

  useEffect(() => {
    // Progress through steps realistically, then stay on final step
    const timeouts: NodeJS.Timeout[] = [];
    
    // Step 1: Analyzing (immediate)
    timeouts.push(setTimeout(() => setCurrentStep(1), 800)); // Move to searching after 0.8s
    timeouts.push(setTimeout(() => setCurrentStep(2), 2500)); // Move to crafting after 2.5s total
    
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return (
    <div className="p-4 rounded-lg bg-fd-muted/30 border border-fd-border/50">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Loader2 className="size-5 animate-spin text-red-600" />
        </div>
        
        <div className="flex-1">
          <div className="text-sm text-fd-muted-foreground transition-all duration-300">
            {loadingSteps[currentStep]}
          </div>
        </div>
      </div>
    </div>
  );
};

function SuggestedFollowUps({ questions, onQuestionClick }: { 
  questions: string[];
  onQuestionClick: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-fd-border/30">
      <p className="text-xs font-medium text-fd-muted-foreground mb-3">
        Related topics you might find helpful:
      </p>
      <div className="grid grid-cols-1 gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className={cn(
              "group relative p-3 rounded-lg border border-fd-border/30 bg-fd-card/50",
              "hover:border-red-600/30 hover:bg-red-50 dark:hover:bg-red-950/30 hover:shadow-sm",
              "transition-all duration-200 ease-out",
              "text-left text-xs"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 p-1 rounded-md bg-fd-muted/50 transition-all duration-200">
                <HelpCircle className="size-3 text-red-600" />
              </div>
              <span className="flex-1 text-fd-foreground/70 group-hover:text-fd-foreground leading-relaxed transition-colors duration-200">
                {question}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Message({ message, isLast, onFollowUpClick, isStreaming, onToolReference }: { 
  message: Message; 
  isLast: boolean;
  onFollowUpClick: (question: string) => void;
  isStreaming?: boolean;
  onToolReference?: (toolId: string) => void;
}) {
  const isUser = message.role === 'user';
  const isMobile = useIsMobile();
  
  // Parse content immediately - this should happen synchronously
  const cleanContent = isUser ? message.content : removeFollowUpQuestions(message.content);
  const followUpQuestions = isUser ? [] : parseFollowUpQuestions(message.content);
  
  // Extract console tool references from AI responses - only on desktop
  const [detectedConsoleTools, setDetectedConsoleTools] = useState<string[]>([]);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  
  useEffect(() => {
    if (!isUser && !isStreaming && !isMobile) {
      const consoleRefs = extractConsoleReferences(message.content);
      // Only keep unique console tool references
      const uniqueConsoleTools = Array.from(new Set(consoleRefs));
      setDetectedConsoleTools(uniqueConsoleTools);
      
      // Always auto-open the first console tool reference if we haven't already
      if (uniqueConsoleTools.length > 0 && onToolReference && !hasAutoOpened) {
        setHasAutoOpened(true);
        // Add a small delay to ensure the component is ready
        setTimeout(() => {
          onToolReference(uniqueConsoleTools[0]);
        }, 100);
      }
    }
  }, [message.content, isUser, isStreaming, onToolReference, isMobile, hasAutoOpened]);
  
  return (
    <div className={cn(
      'group relative',
      !isUser && 'bg-fd-muted/30',
      isStreaming && 'message-streaming'
    )}>
      <div className="flex gap-4 px-4 py-6">
        <div className={cn(
          'flex size-8 shrink-0 items-center justify-center',
          isUser ? 'rounded-full bg-fd-muted text-fd-foreground' : '',
        )}>
          {roleIcon[message.role] ?? <User className="size-5" />}
        </div>
        <div className="flex-1 space-y-2 overflow-hidden">
          <p className="text-xs font-medium text-fd-muted-foreground">
            {roleName[message.role] ?? 'Unknown'}
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert message-content">
            {isStreaming ? (
              <StreamingLoadingBlur />
            ) : (
              <Markdown text={cleanContent} onToolClick={isMobile ? undefined : onToolReference} />
            )}
          </div>
          
          {/* Show all console tools referenced */}
          {!isUser && detectedConsoleTools.length > 0 && !isMobile && onToolReference && (
            <div className="mt-3 flex flex-wrap gap-2">
              <p className="text-xs text-fd-muted-foreground w-full mb-1">Console tools referenced:</p>
              {detectedConsoleTools.map((consolePath) => {
                // Extract a friendly name from the path
                const friendlyName = consolePath.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || consolePath;
                return (
                  <button
                    key={consolePath}
                    onClick={() => onToolReference(consolePath)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                      "bg-fd-muted hover:bg-fd-muted/80 rounded-md",
                      "border border-fd-border hover:border-red-600/30",
                      "transition-all duration-200"
                    )}
                  >
                    <ChevronRight className="size-3" />
                    {friendlyName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Show follow-up suggestions only for the last assistant message and not while streaming */}
      {!isUser && isLast && !isStreaming && followUpQuestions.length > 0 && (
        <SuggestedFollowUps 
          questions={followUpQuestions}
          onQuestionClick={onFollowUpClick}
        />
      )}
    </div>
  );
}
