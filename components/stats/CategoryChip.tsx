"use client";

// Category colors for visual distinction
export const categoryColors: Record<string, string> = {
  "Gaming": "#8B5CF6",
  "General": "#6B7280",
  "Telecom": "#06B6D4",
  "SocialFi": "#F59E0B",
  "DeFi": "#3B82F6",
  "Finance": "#3B82F6",
  "Infrastructure": "#6366F1",
  "Institutions": "#10B981",
  "RWAs": "#F59E0B",
  "Payments": "#F43F5E",
  "Sports": "#F97316",
  "Fitness": "#84CC16",
  "AI": "#A855F7",
  "AI Agents": "#A855F7",
  "Loyalty": "#EAB308",
  "Ticketing": "#14B8A6",
};

// Get category-specific badge styles for selected/unselected states
export function getCategoryBadgeStyle(category: string, selected: boolean): string {
  if (category === "All") {
    return selected 
      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent" 
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700";
  }
  
  const styles: Record<string, { selected: string; normal: string }> = {
    'DeFi': { 
      selected: 'bg-blue-500 text-white border-transparent', 
      normal: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900' 
    },
    'Finance': { 
      selected: 'bg-blue-500 text-white border-transparent', 
      normal: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900' 
    },
    'Gaming': { 
      selected: 'bg-violet-500 text-white border-transparent', 
      normal: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900' 
    },
    'Institutions': { 
      selected: 'bg-emerald-500 text-white border-transparent', 
      normal: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900' 
    },
    'RWAs': { 
      selected: 'bg-amber-500 text-white border-transparent', 
      normal: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900' 
    },
    'Payments': { 
      selected: 'bg-rose-500 text-white border-transparent', 
      normal: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900' 
    },
    'Telecom': { 
      selected: 'bg-cyan-500 text-white border-transparent', 
      normal: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900' 
    },
    'SocialFi': { 
      selected: 'bg-pink-500 text-white border-transparent', 
      normal: 'bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900' 
    },
    'Sports': { 
      selected: 'bg-orange-500 text-white border-transparent', 
      normal: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900' 
    },
    'Fitness': { 
      selected: 'bg-lime-500 text-white border-transparent', 
      normal: 'bg-lime-50 text-lime-600 border-lime-200 dark:bg-lime-950 dark:text-lime-400 dark:border-lime-800 hover:bg-lime-100 dark:hover:bg-lime-900' 
    },
    'AI': { 
      selected: 'bg-purple-500 text-white border-transparent', 
      normal: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900' 
    },
    'AI Agents': { 
      selected: 'bg-purple-500 text-white border-transparent', 
      normal: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900' 
    },
    'Loyalty': { 
      selected: 'bg-yellow-500 text-white border-transparent', 
      normal: 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900' 
    },
    'Ticketing': { 
      selected: 'bg-teal-500 text-white border-transparent', 
      normal: 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900' 
    },
    'General': { 
      selected: 'bg-zinc-500 text-white border-transparent', 
      normal: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700' 
    },
    'Infrastructure': { 
      selected: 'bg-indigo-500 text-white border-transparent', 
      normal: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900' 
    },
  };
  
  const style = styles[category] || styles['General'];
  return selected ? style.selected : style.normal;
}

// Get category color for table badges
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    General: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    DeFi: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    Finance: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    Gaming: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    Institutions: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    RWAs: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    Payments: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    Telecom: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    SocialFi: "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
    Sports: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    Fitness: "bg-lime-50 text-lime-600 dark:bg-lime-950 dark:text-lime-400",
    AI: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    "AI Agents": "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    Loyalty: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
    Ticketing: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
    Infrastructure: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  };
  return colors[category] || colors.General;
}

export interface CategoryChipProps {
  category: string;
  selected: boolean;
  count?: number;
  onClick: () => void;
  size?: "sm" | "md";
}

export function CategoryChip({
  category,
  selected,
  count,
  onClick,
  size = "md",
}: CategoryChipProps) {
  const sizeClasses = size === "sm" 
    ? "px-2.5 py-1 text-xs" 
    : "px-3 py-1.5 text-xs sm:text-sm";

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses} font-medium rounded-full border transition-all cursor-pointer ${getCategoryBadgeStyle(category, selected)}`}
    >
      {category}
      {count !== undefined && (
        <span className="opacity-70 ml-1">({count})</span>
      )}
    </button>
  );
}

