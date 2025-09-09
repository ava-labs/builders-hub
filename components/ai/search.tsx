'use client';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  type DialogProps,
} from '@radix-ui/react-dialog';
import { ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/use-mobile';
import { cn } from '../../lib/cn';
import { buttonVariants } from '../ui/button';
import { ConsoleToolRenderer } from './console-renderer';
import { Content, SmallViewContent } from './chat-panel';

const messageStyles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .message-streaming {
    animation: fade-in-up 0.3s ease-out;
  }
`;

if (typeof document !== 'undefined' && !document.querySelector('#message-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'message-styles';
  styleSheet.type = 'text/css';
  styleSheet.textContent = messageStyles;
  document.head.appendChild(styleSheet);
}

export default function AISearch(props: DialogProps & { onToolSelect?: (consolePath: string) => void }) {
  const [selectedConsolePath, setSelectedConsolePath] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [closedConsoleTools, setClosedConsoleTools] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'big' | 'small'>('big');
  const isMobile = useIsMobile();
  const toolSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCloseConsoleTool = () => {
    if (isClosing) return;
    setIsClosing(true);

    if (toolSwitchTimeoutRef.current) {
      clearTimeout(toolSwitchTimeoutRef.current);
    }

    setTimeout(() => {
      if (selectedConsolePath) {
        setClosedConsoleTools(prev => new Set(prev).add(selectedConsolePath));
      }
      setSelectedConsolePath(null);
      setIsClosing(false);
    }, 50);
  };

  const handleConsoleToolSelect = (consolePath: string) => {
    if (!isMobile && !isClosing) {
      if (selectedConsolePath === consolePath) {
        return;
      }

      if (toolSwitchTimeoutRef.current) {
        clearTimeout(toolSwitchTimeoutRef.current);
      }

      setClosedConsoleTools(prev => {
        const newSet = new Set(prev);
        newSet.delete(consolePath);
        return newSet;
      });

      setSelectedConsolePath(consolePath);
      props.onToolSelect?.(consolePath);
    }
  };

  useEffect(() => {
    return () => {
      if (toolSwitchTimeoutRef.current) {
        clearTimeout(toolSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedConsolePath && !isClosing) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseConsoleTool();
      }
    };

    if (selectedConsolePath) {
      document.addEventListener('keydown', handleEscape, true);
      return () => document.removeEventListener('keydown', handleEscape, true);
    }
  }, [selectedConsolePath, isClosing, handleCloseConsoleTool]);

  const ConsoleRenderer = React.memo(({ consolePath }: { consolePath: string }) => {
    return <ConsoleToolRenderer consolePath={consolePath} />;
  });

  ConsoleRenderer.displayName = 'ConsoleRenderer';

  return (
    <Dialog {...props}>
      {props.children}
      <DialogPortal>
        {viewMode === 'small' ? (
          <>
            <DialogContent
              onOpenAutoFocus={(e) => {
                document.getElementById('nd-ai-input')?.focus();
                e.preventDefault();
              }}
              aria-describedby={undefined}
              className={cn(
                "fixed bottom-24 right-4 z-50",
                "w-[380px] h-[600px] max-h-[80vh]",
                "focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in",
                "transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-fd-background/95 backdrop-blur-sm rounded-xl border border-fd-border shadow-2xl overflow-hidden flex-col">
                <SmallViewContent onExpand={() => setViewMode('big')} />
              </div>
            </DialogContent>
          </>
        ) : (
          <>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in" />
            <DialogContent
              onOpenAutoFocus={(e) => {
                document.getElementById('nd-ai-input')?.focus();
                e.preventDefault();
              }}
              aria-describedby={undefined}
              className={cn(
                "fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50",
                selectedConsolePath && !isMobile ? "md:max-w-[1400px] md:w-[95vw]" : "md:max-w-2xl md:w-[90vw]",
                "md:h-[85vh] max-h-[90vh] focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-fd-background/90 backdrop-blur-md rounded-xl border border-fd-border shadow-2xl overflow-hidden">
                <div className={cn(
                  "hidden md:flex md:flex-col",
                  selectedConsolePath ? "md:w-[40%] md:border-r md:border-fd-border" : "md:w-full"
                )}>
                  <Content onToolReference={handleConsoleToolSelect} onCollapse={() => setViewMode('small')} />
                </div>
                
                <div className="flex md:hidden flex-col w-full">
                  <Content onCollapse={() => setViewMode('small')} />
                </div>
                
                {selectedConsolePath && !isMobile && (
                  <div key={selectedConsolePath} className="hidden md:flex md:w-[60%] md:flex-col bg-fd-muted/20">
                    <div className="console-embedded-header flex items-center justify-between border-b border-fd-border px-4 py-3 relative z-[9999]">
                      <a 
                        href={`/console/${selectedConsolePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-red-600 hover:underline transition-colors cursor-pointer flex items-center gap-1"
                      >
                        Console: {selectedConsolePath.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        <ChevronRight className="size-3" />
                      </a>
                      <button
                        onClick={handleCloseConsoleTool}
                        className={cn(
                          buttonVariants({ size: 'icon', variant: 'ghost' }),
                          'size-6 rounded-md relative z-[9999]',
                        )}
                        style={{ position: 'relative', zIndex: 9999 }}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto bg-fd-background relative">
                      <ConsoleRenderer consolePath={selectedConsolePath} />
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </>
        )}
      </DialogPortal>
    </Dialog>
  );
}
