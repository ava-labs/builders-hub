'use client';

import { useEffect, useState, useRef } from 'react';

interface UseSequentialAnimationProps {
  itemCount: number;
  delay?: number;
  duration?: number;
}

export const useSequentialAnimation = ({ 
  itemCount, 
  delay = 200, 
  duration = 600 
}: UseSequentialAnimationProps) => {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    new Array(itemCount).fill(false)
  );
  const [hasStarted, setHasStarted] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true);
            // Start sequential animation
            for (let i = 0; i < itemCount; i++) {
              setTimeout(() => {
                setVisibleItems(prev => {
                  const newState = [...prev];
                  newState[i] = true;
                  return newState;
                });
              }, i * delay);
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observerRef.current.observe(containerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [itemCount, delay, hasStarted]);

  const getItemStyle = (index: number) => ({
    transform: visibleItems[index] ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
    opacity: visibleItems[index] ? 1 : 0,
    transition: `all ${duration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`,
  });

  return {
    containerRef,
    getItemStyle,
    hasStarted,
    visibleItems
  };
};
