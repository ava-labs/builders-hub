"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center justify-center rounded-full border p-1",
        className
      )}
      aria-label="Toggle Theme"
    >
      <Sun
        className={cn(
          "size-6.5 rounded-full p-1.5",
          mounted && resolvedTheme === "light"
            ? "bg-fd-accent text-fd-accent-foreground"
            : "text-fd-muted-foreground"
        )}
        fill="currentColor"
      />
      <Moon
        className={cn(
          "size-6.5 rounded-full p-1.5",
          mounted && resolvedTheme === "dark"
            ? "bg-fd-accent text-fd-accent-foreground"
            : "text-fd-muted-foreground"
        )}
        fill="currentColor"
      />
    </button>
  );
}
