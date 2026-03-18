"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { AISearchTrigger } from "@/components/ai";
import { cn } from "@/lib/cn";

interface ChatbotProps {
  variant?: "fixed" | "static";
  className?: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ variant = "fixed", className }) => {
  const pathname = usePathname();
  const isStatsPage = pathname?.startsWith("/stats");

  return (
    <AISearchTrigger
      className={cn(
        "group relative transition-transform duration-300 hover:scale-110 focus:outline-none cursor-pointer",
        variant === "fixed"
          ? "fixed bottom-6 right-6 z-50"
          : "relative inline-flex items-center justify-center",
        // Hide on mobile stats pages only, visible everywhere else
        variant === "fixed" && isStatsPage && "hidden md:block",
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
            variant === "fixed" ? "h-16 w-16" : "h-12 w-12"
          )}
        />
      </div>
    </AISearchTrigger>
  );
};

export default Chatbot;
