"use client";
import React from 'react';
import { AISearchTrigger } from '@/components/ai';
import { cn } from '@/lib/cn';

interface ChatbotProps {
  variant?: 'fixed' | 'static';
  className?: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ variant = 'fixed', className }) => {
  return (
    <AISearchTrigger
      className={cn(
        "group relative transition-transform duration-300 hover:scale-110 focus:outline-none cursor-pointer z-50 fixed",
        variant === 'fixed'
          ? // Mobile: top-left (near navbar), Desktop: bottom-right
            "max-[1023px]:top-1 max-[1023px]:left-2 min-[1024px]:bottom-6 min-[1024px]:right-6"
          : "relative inline-flex items-center justify-center",
        className
      )}
      aria-label="Open AI Assistant"
    >
      <div className="relative">
        <img
          src="/avax-gpt.png"
          alt="AI Assistant"
          className={cn(
            "relative object-contain drop-shadow-lg dark:invert",
            // Smaller on mobile
            variant === 'fixed'
              ? "max-[1023px]:h-12 max-[1023px]:w-12 min-[1024px]:h-16 min-[1024px]:w-16"
              : "h-12 w-12"
          )}
        />
      </div>
    </AISearchTrigger>
  );
};

export default Chatbot;