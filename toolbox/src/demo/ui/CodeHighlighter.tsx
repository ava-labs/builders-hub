import { useEffect, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import solidity from 'react-syntax-highlighter/dist/esm/languages/prism/solidity';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

// Register only TypeScript language for now

const DARK_THEME = vscDarkPlus;
const LIGHT_THEME = oneLight;

const availableLanguages = ['ts', 'tsx', 'sh', 'bash', 'json', 'sol'];

SyntaxHighlighter.registerLanguage('ts', ts);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('sol', solidity);

interface CodeHighlighterProps {
    code: string;
    lang: string;
    maxHeight?: number;
    footer?: React.ReactNode;
    disableCopy?: boolean;
}

export function CodeHighlighter({ code, lang, maxHeight, footer, disableCopy }: CodeHighlighterProps) {
    const [isDark, setIsDark] = useState(false);
    const [copied, setCopied] = useState(false);
    const theme = isDark ? DARK_THEME : LIGHT_THEME;

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const checkIsDark = () => {
            return document.documentElement.classList.contains('dark') ||
                (!document.documentElement.classList.contains('light') &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
        };

        // Set initial dark mode
        setIsDark(checkIsDark());

        // Watch for class changes on html element
        const observer = new MutationObserver(() => {
            setIsDark(checkIsDark());
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Watch for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = () => {
            setIsDark(checkIsDark());
        };

        mediaQuery.addEventListener('change', handleThemeChange);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', handleThemeChange);
        };
    }, []);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!availableLanguages.includes(lang)) {
        return <div className="text-red-500">
            Language "{lang}" is not supported yet by CodeHighlighter.tsx. Edit the file to add support for it.
        </div>
    }

    return (
        <div className="my-4 border border-gray-200 dark:border-gray-700 rounded-md w-full overflow-hidden relative" style={{
            backgroundColor: isDark ? '#000000' : 'rgb(250, 250, 250)',
        }}>
            {!disableCopy && <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Copy code"
            >
                {copied ? (
                    <Check size={16} className="text-green-500" />
                ) : (
                    <Copy size={16} className="text-gray-500 dark:text-gray-400" />
                )}
            </button>}

            <div style={{
                maxHeight: maxHeight ? `${maxHeight}px` : undefined,
                overflow: maxHeight ? 'auto' : undefined,
            }}>
                <SyntaxHighlighter
                    language={lang}
                    style={theme}
                    showLineNumbers={true}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.25rem',
                        borderRadius: '0.5rem',
                        overflow: 'auto',
                        background: 'transparent',
                    }}
                >
                    {code}
                </SyntaxHighlighter>
            </div>
            {footer && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs  dark: border-t border-gray-200 dark:border-gray-700 rounded-b-md">
                    {footer}
                </div>
            )}
        </div>
    );
} 
