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
  return (
    <AISearchTrigger
      className={cn(
        buttonVariants({ variant: 'outline', size: 'icon' }),
        variant === 'fixed' 
          ? 'fixed bottom-4 right-4 z-40' 
          : 'relative',
        'h-14 min-w-[3.5rem] rounded-full shadow-lg transition-all duration-300 ease-in-out',
        'hover:shadow-xl hover:min-w-[160px] group overflow-hidden',
        className
      )}
      aria-label="Open AI Assistant"
    >
      <div className="flex items-center justify-center px-4 w-full h-full">
        <Sparkles className="h-5 w-5 text-red-600 flex-shrink-0" />
        <span className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out max-w-0 opacity-0 group-hover:ml-2 group-hover:max-w-[100px] group-hover:opacity-100">
          AI Assistant
        </span>
      </div>
    </AISearchTrigger>
  );
};

export default Chatbot;