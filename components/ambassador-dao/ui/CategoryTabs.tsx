'use client';

import React, { useState, useEffect } from 'react';
import { Code, Paintbrush, Monitor, FileText, Megaphone, MonitorPlay, PenTool, CodeXml } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  icon: React.ReactNode;
};

interface CategoryTabsProps {
  onCategoryChange?: (category: string) => void;
  initialCategory?: string;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ 
  onCategoryChange,
  initialCategory = ""
}) => {
  const categories: Category[] = [
    {
      id: "code",
      name: "Code & Programming",
      icon: <CodeXml color="var(--white-text-color)" size={24}
      />,
    },
    {
      id: "design",
      name: "Design",
      icon: (
        <PenTool
          color="var(--white-text-color)"
          size={24}
          className="rotate-270"
        />
      ),
    },
    {
      id: "technology",
      name: "Technology",
      icon: <MonitorPlay color="var(--white-text-color)" size={24} />,
    },
    {
      id: "content",
      name: "Content",
      icon: <Megaphone color="var(--white-text-color)" size={24}
      className="scale-x-[-1]"
      />,
    },
  ];

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => handleCategorySelect(category.id)}
          className={`
            flex flex-wrap justify-center sm:justify-normal sm:flex-nowrap items-center gap-3 px-6 py-4 h-24 rounded-lg transition-all bg-[var(--primary-secondary-color)] 
            ${
              selectedCategory === category.id
                ? "border border-red-500"
                : "border border-gray-800"
            }
          `}
          aria-selected={selectedCategory === category.id}
        >
          <span className="text-[var(--white-text-color)]">
            {category.icon}
          </span>
          <span className="font-medium text-xs lg:!text-lg">{category.name}</span>
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;