"use client";

import { useState, useEffect } from "react";

interface SyntaxHighlightedJSONProps {
    code: string;
    highlightedLine: number | null;
}

// Simple JSON syntax highlighter component for mobile view
export function SyntaxHighlightedJSON({ code, highlightedLine }: SyntaxHighlightedJSONProps) {
    const [highlightedElements, setHighlightedElements] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (highlightedLine !== null) {
            setHighlightedElements(new Set([highlightedLine]));
        } else {
            setHighlightedElements(new Set());
        }
    }, [highlightedLine]);

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
        <div className="relative font-mono text-[11px] leading-5">
            <pre className="whitespace-pre-wrap overflow-x-auto">
                {lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const isHighlighted = highlightedElements.has(lineNumber);

                    return (
                        <div
                            key={lineNumber}
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
