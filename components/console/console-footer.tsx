import { Github } from "lucide-react";

export function ConsoleFooter() {
  return (
    <footer className="mt-auto pt-6 pb-2 px-1 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 text-left">
          Crafted with <span aria-hidden>❤️</span> by Ava Labs DevRel team.
        </div>
        <div className="flex-1 flex justify-center">
          <a
            href="https://github.com/ava-labs/avalanche-sdk-typescript"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <span>powered by</span>
            <span className="font-mono">avalanche-sdk-typescript</span>
            <Github className="size-3.5" />
          </a>
        </div>
        <div className="flex-1 text-right">© 2026 Ava Labs, Inc.</div>
      </div>
    </footer>
  );
}
