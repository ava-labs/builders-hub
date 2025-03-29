'use client';

import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { CodeSnippet } from './code-snippet';

interface InstallCommandProps {
  className?: string;
}

export const InstallCommand: React.FC<InstallCommandProps> = ({ className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install @avalabs/builderkit');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("max-w-fit mx-auto", className)}>
      <div className="bg-black dark:bg-foreground/[0.1] backdrop-blur-xs border border-foreground/[0.05] rounded-lg overflow-hidden px-4">
        <div className="flex items-center justify-center gap-4 p-4 text-sm overflow-x-auto scrollbar-thin">
          <CodeSnippet
            code="npm install @avalabs/builderkit"
            language='bash'
          />
          <button onClick={handleCopy} className="p-2 flex items-center">
            {copied ? <CheckIcon className="w-4 h-4 text-green-500!" /> : <CopyIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};