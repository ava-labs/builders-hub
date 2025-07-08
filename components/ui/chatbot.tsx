"use client";
import React from 'react';
import { AISearchTrigger } from '@/components/ai';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';

const Chatbot: React.FC = () => {
  return (
    <AISearchTrigger
      className={cn(
        buttonVariants({ variant: 'outline', size: 'icon' }),
        'fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow'
      )}
      aria-label="Open AI Assistant"
    >
      <Sparkles className="h-5 w-5 text-blue-500" />
    </AISearchTrigger>
  );
};

export default Chatbot;