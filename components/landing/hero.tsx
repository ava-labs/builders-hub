"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import Image from "next/image";
import { Sponsors } from '@/components/landing/globe';
import { GraduationCap } from 'lucide-react';
import Chatbot from '@/components/ui/chatbot';

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
    0%, 14% { 
      transform: translateY(0%); 
    }
    16%, 28% { 
      transform: translateY(-12.5%); 
    }
    30%, 42% { 
      transform: translateY(-25%); 
    }
    44%, 56% { 
      transform: translateY(-37.5%); 
    }
    58%, 70% { 
      transform: translateY(-50%); 
    }
    72%, 84% { 
      transform: translateY(-62.5%); 
    }
    86%, 98% { 
      transform: translateY(-75%); 
    }
    100% { 
      transform: translateY(-87.5%); 
    }
  }
  
  .text-rotator {
    overflow: hidden;
    position: relative;
    display: inline-block;
    vertical-align: top;
  }
  
  .text-rotator-inner {
    animation: rotate-up 24s ease-in-out infinite;
    will-change: transform;
  }
  
  /* Mobile-specific improvements */
  @media (max-width: 640px) {
    .text-rotator {
      min-width: 90px !important;
      text-align: center;
    }
    
    .text-rotator-inner {
      animation-duration: 20s;
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

// Rotating Text Component
function RotatingText() {
  const words = ['Courses', 'Events', 'Hackathons', 'Bounties', 'Tools', 'Grants', 'Documentation', 'Academy'];

  return (
    <span className="text-rotator min-w-[100px] sm:min-w-[140px] lg:min-w-[180px] xl:min-w-[220px] h-[1.3em] text-center lg:text-left inline-block">
      <div className="text-rotator-inner">
        {words.map((word, index) => (
          <div 
            key={index}
            className="h-[1.3em] flex items-center justify-center lg:justify-start bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-black tracking-tighter whitespace-nowrap"
          >
            {word}
          </div>
        ))}
      </div>
    </span>
  );
}

// Extract Background Component
export function HeroBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#0A0A0A]">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
        
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="min-h-[50vh] w-full flex items-center justify-center relative py-8 lg:py-12">
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* Content Section */}
          <div className="space-y-8 text-center lg:text-left">
            
            {/* Main Heading */}
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.95] sm:leading-[0.95] lg:leading-[0.9] xl:leading-[0.85]">
                <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-white animate-gradient-shift">
                Builder Hub
                </span>
              </h1>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.2] flex items-center justify-center lg:justify-start min-h-[1.5em]">
                <RotatingText />
              </h2>
              
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-2xl text-slate-600 dark:text-slate-300 font-light leading-[1.5] tracking-[-0.025em] max-w-2xl mx-auto lg:mx-0 text-balance">
                Explore everything you need to go from idea to impact.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/academy"
                className="group premium-button inline-flex items-center justify-center px-8 py-4 text-base font-bold tracking-[-0.015em] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-[1.02] transition-all duration-300 dark:shadow-blue-500/50 dark:hover:shadow-blue-500/70"
              >
                <GraduationCap className="w-5 h-5 mr-3" />
                Start Learning
              </Link>
              
              <Link
                href="/docs"
                className="group premium-button inline-flex items-center justify-center px-8 py-4 text-base font-bold tracking-[-0.015em] rounded-xl bg-white/10 glass-effect border border-slate-200/30 text-slate-900 dark:text-white hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm dark:border-slate-700/40"
              >
                Build
                <svg className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            
            {/* AI Assistant */}
            <div className="flex justify-center lg:justify-start mt-4">
              <Chatbot 
                variant="static" 
                className="bg-transparent border-slate-200 dark:border-slate-700 shadow-none hover:shadow-lg min-w-[160px]" 
              />
            </div>
          </div>

          {/* Ecosystem Visualization */}
          <div className="relative lg:block hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-3xl blur-2xl dark:via-slate-800/10"></div>
            <div className="relative glass-effect bg-white/5 dark:bg-slate-900/10 rounded-3xl border border-white/10 dark:border-slate-700/20 p-8 backdrop-blur-2xl">
              <Sponsors />
            </div>
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