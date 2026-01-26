"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sponsors } from '@/components/landing/globe';
import { GraduationCap, Sparkles, ArrowRight } from 'lucide-react';

// Premium animation styles
const premiumStyles = `
  @keyframes gentle-float {
    0%, 100% { 
      transform: translateY(0px); 
    }
    50% { 
      transform: translateY(-8px); 
    }
  }
  
  @keyframes subtle-glow {
    0%, 100% { 
      opacity: 0.4;
    }
    50% { 
      opacity: 0.8;
    }
  }
  
  @keyframes gradient-shift {
    0%, 100% { 
      background-position: 0% 50%;
    }
    50% { 
      background-position: 100% 50%;
    }
  }
  
  @keyframes constellation-twinkle {
    0%, 100% { 
      opacity: 0.3;
    }
    50% { 
      opacity: 1;
    }
  }
  
  .animate-gentle-float {
    animation: gentle-float 6s ease-in-out infinite;
  }
  
  .animate-subtle-glow {
    animation: subtle-glow 3s ease-in-out infinite;
  }
  
  .animate-gradient-shift {
    animation: gradient-shift 8s ease-in-out infinite;
    background-size: 200% 200%;
  }
  
  .animate-constellation-twinkle {
    animation: constellation-twinkle 4s ease-in-out infinite;
  }
  
  /* Premium glassmorphism */
  .glass-effect {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  
  /* Premium button hover effects */
  .premium-button {
    position: relative;
    overflow: hidden;
  }
  
  .premium-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s;
  }
  
  .premium-button:hover::before {
    left: 100%;
  }
  
  /* Rotating text animations */
  @keyframes rotate-up {
    0%, 10% { 
      transform: translateY(0%); 
    }
    11.11%, 21.11% { 
      transform: translateY(-11.11%); 
    }
    22.22%, 32.22% { 
      transform: translateY(-22.22%); 
    }
    33.33%, 43.33% { 
      transform: translateY(-33.33%); 
    }
    44.44%, 54.44% { 
      transform: translateY(-44.44%); 
    }
    55.55%, 65.55% { 
      transform: translateY(-55.55%); 
    }
    66.66%, 76.66% { 
      transform: translateY(-66.66%); 
    }
    77.77%, 87.77% { 
      transform: translateY(-77.77%); 
    }
    88.88%, 100% { 
      transform: translateY(-88.88%); 
    }
  }
  
  .text-rotator {
    overflow: hidden;
    position: relative;
    display: inline-block;
    vertical-align: top;
  }
  
  .text-rotator-inner {
    animation: rotate-up 36s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    will-change: transform;
    transform: translateY(0%);
  }
  
  /* Mobile-specific improvements */
  @media (max-width: 640px) {
    .text-rotator {
      min-width: 140px !important;
      text-align: center;
    }
    
    .text-rotator-inner {
      animation-duration: 30s;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = premiumStyles;
  document.head.appendChild(styleSheet);
}

// Random taglines (Minecraft splash style)
const taglines = [
  // The journey
  "From your first contract to your own blockchain.",
  "C-Chain for day one. Your own L1 when you outgrow it.",
  "Start permissionless. Go sovereign when ready.",
  "The only network where your app can graduate to its own blockchain.",
  "The network that grows with you.",

  // Choice/flexibility
  "Deploy a contract or deploy a blockchain.",
  "Shared chain or sovereign chain. You decide.",
  "Build on ours or build your own.",
  "Your chain, your rules, your fees.",

  // Speed/performance
  "Sub-second finality. No compromises.",
  "Same finality whether you're on C-Chain or your own chain.",
  "Instant finality changes everything.",
  "EVM compatible. Avalanche fast.",

  // Builder attitude
  "Why rent blockspace when you can own the block?",
  "Stop fighting for gas. Get your own chain.",
  "No gas wars. Just building.",
  "Your app deserves its own chain.",
  "Where serious builders ship.",
  "Ship fast. Scale faster.",

  // Cheeky
  "Launch a chain before lunch.",
  "Blockchains shouldn't be hard.",
  "Yes, you can have your own blockchain.",
];

function Tagline() {
  const [tagline, setTagline] = useState(taglines[0]);

  useEffect(() => {
    setTagline(taglines[Math.floor(Math.random() * taglines.length)]);
  }, []);

  return (
    <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mx-auto lg:mx-0">
      {tagline}
    </p>
  );
}

// Rotating Text Component
function RotatingText() {
  const words = ['Documentation', 'Academy', 'Console', 'Hackathons', 'Bounties', 'Events', 'Grants', 'Stats'];
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Show only first word on server-side render to prevent flash
    return (
      <span className="text-rotator min-w-[140px] sm:min-w-[180px] lg:min-w-[220px] xl:min-w-[280px] h-[1.3em] text-center lg:text-left inline-block">
        <div className="h-[1.3em] flex items-center justify-center lg:justify-start bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-black tracking-tighter whitespace-nowrap">
          {words[0]}
        </div>
      </span>
    );
  }

  return (
    <span className="text-rotator min-w-[140px] sm:min-w-[180px] lg:min-w-[220px] xl:min-w-[280px] h-[1.3em] text-center lg:text-left inline-block">
      <div className="text-rotator-inner">
        {words.map((word, index) => (
          <div 
            key={index}
            className="h-[1.3em] flex items-center justify-center lg:justify-start bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-black tracking-tighter whitespace-nowrap"
          >
            {word}
          </div>
        ))}
        {/* Duplicate first word for smooth loop */}
        <div 
          className="h-[1.3em] flex items-center justify-center lg:justify-start bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-black tracking-tighter whitespace-nowrap"
        >
          {words[0]}
        </div>
      </div>
    </span>
  );
}

// Placeholder questions based on actual docs/academy content
const PLACEHOLDER_QUESTIONS = [
  "How do I create my own L1?",
  "Deploy a smart contract on C-Chain",
  "Send tokens between L1s with ICTT",
  "Run a validator node",
  "What are the staking requirements?",
  "Set up Interchain Messaging",
  "Use Avalanche CLI to deploy",
  "Create a custom gas token",
  "How does Avalanche consensus work?",
  "Bridge tokens to my L1",
  "Add a custom precompile",
  "Set up a local testnet",
];

// Hero Search Box Component - matches the glassmorphism style of CTA buttons
function HeroSearchBox() {
  const [question, setQuestion] = useState(PLACEHOLDER_QUESTIONS[0]);

  // Pick a random question on mount
  useEffect(() => {
    setQuestion(PLACEHOLDER_QUESTIONS[Math.floor(Math.random() * PLACEHOLDER_QUESTIONS.length)]);
  }, []);

  return (
    <Link
      href={`/chat?q=${encodeURIComponent(question)}`}
      className={cn(
        "group premium-button flex items-center gap-3 px-8 py-4 rounded-xl transition-all duration-300",
        "w-full sm:w-[336px]",
        "bg-white/60 dark:bg-zinc-800/80 glass-effect border border-slate-200/50 dark:border-slate-600/50",
        "hover:bg-white/80 dark:hover:bg-zinc-800/90 hover:scale-[1.02]"
      )}
    >
      <Sparkles className="w-6 h-6 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
      <span className="flex-1 text-slate-600 dark:text-slate-400 text-lg sm:text-base font-bold tracking-[-0.015em]">
        {question}
      </span>
      <ArrowRight className="w-6 h-6 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
    </Link>
  );
}

// Extract Background Component
export function HeroBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-[#0A0A0A]">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="min-h-[50vh] w-full flex items-center justify-center relative py-12 lg:py-16 px-4">
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Content Section */}
          <div className="space-y-8 text-center lg:text-left">
            
            {/* Main Heading */}
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.95] sm:leading-[0.95] lg:leading-[0.9] xl:leading-[0.85]">
                <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-white animate-gradient-shift">
                Builder Hub
                </span>
              </h1>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.2] flex items-center justify-center lg:justify-start min-h-[1.5em]">
                <RotatingText />
              </h2>

              <Tagline />
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center lg:justify-start items-center">
              <Link
                href="/academy"
                className="group premium-button inline-flex items-center justify-center px-8 py-4 text-lg sm:text-base font-bold tracking-[-0.015em] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-[1.02] transition-all duration-300 dark:shadow-blue-500/50 dark:hover:shadow-blue-500/70 min-w-[160px]"
              >
                <GraduationCap className="w-6 h-6 sm:w-5 sm:h-5 mr-3" />
                Start Learning
              </Link>

              <Link
                href="/docs/primary-network"
                className="group premium-button inline-flex items-center justify-center px-8 py-4 text-lg sm:text-base font-bold tracking-[-0.015em] rounded-xl bg-white/10 glass-effect border border-slate-200/30 text-slate-900 dark:text-white hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm dark:border-slate-700/40 min-w-[160px]"
              >
                Build
                <svg className="w-6 h-6 sm:w-5 sm:h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {/* AI Search Box - below CTA buttons */}
            <div className="hidden sm:flex justify-center lg:justify-start">
              <HeroSearchBox />
            </div>
          </div>

          {/* Ecosystem Visualization */}
          <div className="relative lg:block hidden">
            <Sponsors />
          </div>
        </div>
      </div>
    </section>
  );
}

function GradientBG({
	children,
	className,
	...props
}: React.PropsWithChildren<
	{
		className?: string;
	} & React.HTMLAttributes<HTMLElement>
>) {
	return (
		<div
			className={cn(
				"relative flex content-center items-center flex-col flex-nowrap h-min justify-center overflow-visible p-px w-full",
			)}
			{...props}
		>
			<div className={cn("w-auto z-10 px-4 py-2 rounded-none", className)}>
				{children}
			</div>
			<div className="bg-zinc-100 dark:bg-zinc-950 absolute z-1 flex-none inset-[2px] " />
		</div>
	);
}