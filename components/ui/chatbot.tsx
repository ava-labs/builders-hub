"use client";
import React from 'react';
import { AISearchTrigger } from '@/components/ai';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';

interface ChatbotProps {
  variant?: 'fixed' | 'static';
  className?: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ variant = 'fixed', className }) => {
  const isStatic = variant === 'static';
  
  return (
    <AISearchTrigger
      className={cn(
        buttonVariants({ variant: 'outline', size: 'icon' }),
        variant === 'fixed' 
          ? 'fixed bottom-4 right-4 z-40' 
          : 'relative',
        'h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out',
        'hover:shadow-xl group overflow-hidden',
        isStatic ? 'min-w-[160px] px-4' : 'min-w-[3.5rem] hover:min-w-[160px]',
        className
      )}
      aria-label="Open AI Assistant"
    >
      <div className={cn(
        "flex items-center justify-center w-full h-full",
        isStatic ? "gap-2" : "group-hover:gap-2"
      )}>
        <Sparkles className="h-5 w-5 text-red-600 flex-shrink-0" />
        <span className={cn(
          "whitespace-nowrap transition-all duration-300 ease-in-out",
          isStatic 
            ? "opacity-100" 
            : "overflow-hidden max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100"
        )}>
          AI Assistant
        </span>
      </div>
    </AISearchTrigger>
  );
};

export default Chatbot;