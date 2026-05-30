"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  title: string;
  description: string;
  icon: React.ReactNode;
  url: string;
}

interface RootToggleProps {
  options: Option[];
}

export function RootToggle({ options }: RootToggleProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Find the first option (usually the header/title option)
  const headerOption = options[0];
  const menuOptions = options.slice(1);

  // Find active option based on pathname
  const activeOption = menuOptions.find((opt) =>
    opt.url && pathname?.startsWith(opt.url)
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
          "hover:bg-fd-accent hover:text-fd-accent-foreground",
          open && "bg-fd-accent text-fd-accent-foreground"
        )}
      >
        <span>{headerOption?.title || "Menu"}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border bg-fd-popover p-1 shadow-lg">
          {menuOptions.map((option) => (
            <Link
              key={option.url || option.title}
              href={option.url || "#"}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-fd-accent hover:text-fd-accent-foreground",
                activeOption?.url === option.url && "bg-fd-accent/50"
              )}
            >
              {option.icon && (
                <span className="size-5 shrink-0 [&>svg]:size-full">
                  {option.icon}
                </span>
              )}
              <div className="flex flex-col">
                <span className="font-medium">{option.title}</span>
                {option.description && (
                  <span className="text-xs text-fd-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
