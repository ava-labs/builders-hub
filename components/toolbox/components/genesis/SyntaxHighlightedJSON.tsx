"use client";

import { useState, useEffect, useRef } from "react";

interface SyntaxHighlightedJSONProps {
    code: string;
    highlightedLine?: number | null;
    highlightedLines?: number[];
}

// Simple JSON syntax highlighter component for mobile view
export function SyntaxHighlightedJSON({ code, highlightedLine, highlightedLines }: SyntaxHighlightedJSONProps) {
    const [highlightedElements, setHighlightedElements] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const highlightedLineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    useEffect(() => {
        // Support both single line and multiple lines
        if (highlightedLines && highlightedLines.length > 0) {
            setHighlightedElements(new Set(highlightedLines));
            
            // Scroll to first highlighted line after a brief delay to ensure render is complete
            setTimeout(() => {
                const firstLine = Math.min(...highlightedLines);
                const element = highlightedLineRefs.current.get(firstLine);
                if (element && containerRef.current) {
                    const scrollContainer = containerRef.current.parentElement;
                    if (scrollContainer) {
                        // Get positions relative to the scroll container
                        const elementTop = element.offsetTop;
                        const containerScrollTop = scrollContainer.scrollTop;
                        const containerHeight = scrollContainer.clientHeight;
                        const containerVisibleTop = containerScrollTop;
                        const containerVisibleBottom = containerScrollTop + containerHeight;
                        
                        // Check if element is outside visible area
                        const isAbove = elementTop < containerVisibleTop;
                        const isBelow = elementTop > containerVisibleBottom - 50; // 50px buffer
                        
                        if (isAbove || isBelow) {
                            // Scroll within container only, centering the element
                            const targetScroll = elementTop - (containerHeight / 2) + 25;
                            scrollContainer.scrollTo({
                                top: Math.max(0, targetScroll),
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }, 100);
        } else if (highlightedLine !== null && highlightedLine !== undefined) {
            setHighlightedElements(new Set([highlightedLine]));
            
            // Scroll to highlighted line
            setTimeout(() => {
                const element = highlightedLineRefs.current.get(highlightedLine);
                if (element && containerRef.current) {
                    const scrollContainer = containerRef.current.parentElement;
                    if (scrollContainer) {
                        const elementTop = element.offsetTop;
                        const containerScrollTop = scrollContainer.scrollTop;
                        const containerHeight = scrollContainer.clientHeight;
                        const containerVisibleTop = containerScrollTop;
                        const containerVisibleBottom = containerScrollTop + containerHeight;
                        
                        const isAbove = elementTop < containerVisibleTop;
                        const isBelow = elementTop > containerVisibleBottom - 50;
                        
                        if (isAbove || isBelow) {
                            const targetScroll = elementTop - (containerHeight / 2) + 25;
                            scrollContainer.scrollTo({
                                top: Math.max(0, targetScroll),
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }, 100);
        } else {
            setHighlightedElements(new Set());
        }
    }, [highlightedLine, highlightedLines]);

    const syntaxHighlight = (json: string) => {
        return json
            .replace(/(".*?")(\s*:)/g, '<span class="text-green-600 dark:text-green-400">$1</span>$2')
            .replace(/:\s*(".*?")/g, ': <span class="text-yellow-600 dark:text-yellow-400">$1</span>')
            .replace(/:\s*(\b\d+\.?\d*\b)/g, ': <span class="text-orange-600 dark:text-orange-400">$1</span>')
            .replace(/:\s*(\b(?:true|false|null)\b)/g, ': <span class="text-blue-600 dark:text-blue-400">$1</span>')
            .replace(/("0x[0-9a-fA-F]+")/g, '<span class="text-purple-600 dark:text-purple-400">$1</span>')
            .replace(/(\{|\}|\[|\])/g, '<span class="text-zinc-600 dark:text-zinc-300">$1</span>');
    };

    const lines = code.split('\n');

    return (
        <div ref={containerRef} className="relative font-mono text-[11px] leading-5">
            <pre className="whitespace-pre-wrap overflow-x-auto">
                {lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const isHighlighted = highlightedElements.has(lineNumber);

                    return (
                        <div
                            key={lineNumber}
                            ref={(el) => {
                                if (el && isHighlighted) {
                                    highlightedLineRefs.current.set(lineNumber, el);
                                }
                            }}
                            className={`relative ${isHighlighted ? 'bg-blue-200/30 dark:bg-blue-800/30' : ''}`}
                            style={{
                                paddingTop: '1px',
                                paddingBottom: '1px'
                            }}
                            data-line={lineNumber}
                        >
                            <span className="text-zinc-500 dark:text-zinc-400 pr-3 select-none inline-block w-8 text-right">
                                {lineNumber.toString().padStart(3, ' ')}
                            </span>
                            <span dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }} />
                        </div>
                    );
                })}
            </pre>
        </div>
    );
}
