"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CliAlternativeProps {
  command: string;
}

export function CliAlternative({ command }: CliAlternativeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  // Parse into: base command + flag pairs
  // Respect quoted strings so "My Chain" stays as one token
  const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const base: string[] = [];
  const flags: { flag: string; value?: string }[] = [];
  let i = 0;

  while (i < tokens.length && !tokens[i].startsWith("--")) {
    base.push(tokens[i]);
    i++;
  }

  while (i < tokens.length) {
    if (tokens[i].startsWith("--")) {
      const flag = tokens[i];
      const val = i + 1 < tokens.length && !tokens[i + 1].startsWith("--") ? tokens[++i] : undefined;
      flags.push({ flag, value: val });
    }
    i++;
  }

  const multiLine = flags.length > 1;

  return (
    <div>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          or via CLI
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="group relative rounded-lg bg-muted/50 border border-border px-4 py-3.5">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-colors"
          aria-label="Copy command"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-all">
          <span className="text-muted-foreground/50 select-none">$ </span>
          <span className="text-foreground font-medium">{base.join(" ")}</span>
          {flags.map((f, idx) => (
            <span key={idx}>
              {multiLine ? (
                <>
                  {" "}
                  <span className="text-muted-foreground/40 select-none">\</span>
                  {"\n"}
                  {"    "}
                </>
              ) : " "}
              <span className="text-muted-foreground">{f.flag}</span>
              {f.value && <> <span className="text-primary">{f.value}</span></>}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
