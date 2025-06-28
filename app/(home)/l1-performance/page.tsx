'use client';

import { useState, useEffect } from 'react';
import { 
  AnimatedBackground,
  HeroSection,
  MetricsSection,
  HorizontalScrollSection,
  FAQSection,
  CTASection
} from '@/components/l1-performance';

export default function L1PerformancePage() {
  const [isInSlider, setIsInSlider] = useState(false);

  // Initialize custom animations
  useEffect(() => {
    addCustomAnimations();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatedBackground />
      <main className="relative">
        <HeroSection />
        <MetricsSection />
        <HorizontalScrollSection isInSlider={isInSlider} setIsInSlider={setIsInSlider} />
        <FAQSection />
        <CTASection />
      </main>
    </div>
  );
}

// Add custom animations to global CSS
const addCustomAnimations = () => {
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes circuit-vertical {
        0% { transform: translateY(-100%); opacity: 0; }
        50% { opacity: 0.5; }
        100% { transform: translateY(100%); opacity: 0; }
      }
      
      @keyframes wave {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      .animate-circuit-vertical {
        animation: circuit-vertical 8s linear infinite;
      }
      
      .animate-wave {
        animation: wave 8s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
};
