"use client";

import React, { useState, useEffect } from "react";

interface NavItem {
  name: string;
  ref: string;
}

interface CustomNavigationProps {
  items: NavItem[];
}

export default function CustomNavigation({ items }: CustomNavigationProps) {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      // Find which section is currently in view
      const sections = items.map(item => document.getElementById(item.ref));
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(items[i].ref);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Call once to set initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  const scrollToSection = (ref: string) => {
    const element = document.getElementById(ref);
    if (element) {
      const offset = 150;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <nav className="w-full">
      {/* Desktop Navigation */}
      <div className="hidden lg:flex items-center justify-center flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.ref}
            onClick={() => scrollToSection(item.ref)}
            className={`
              relative px-4 py-2 rounded-md font-['Aeonik:Medium',sans-serif] font-medium text-sm
              transition-all duration-200
              ${
                activeSection === item.ref
                  ? "text-[#66acd6] bg-[#66acd6]/10 border border-[#66acd6]/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }
            `}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* Mobile Navigation - Horizontal Scroll */}
      <div className="lg:hidden overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 min-w-max">
          {items.map((item) => (
            <button
              key={item.ref}
              onClick={() => scrollToSection(item.ref)}
              className={`
                relative px-4 py-2 rounded-md font-['Aeonik:Medium',sans-serif] font-medium text-sm whitespace-nowrap
                transition-all duration-200
                ${
                  activeSection === item.ref
                    ? "text-[#66acd6] bg-[#66acd6]/10 border border-[#66acd6]/30"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }
              `}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
