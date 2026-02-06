"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePopularSkills } from "./hooks/usePopularSkills";
import { useDebounce } from "@/components/hackathons/project-submission/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

interface SkillsAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (skill: string) => void;
  existingSkills: string[];
  placeholder?: string;
}

export function SkillsAutocomplete({
  value,
  onChange,
  onSelect,
  existingSkills,
  placeholder = "Select skills...",
}: SkillsAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { searchSkills, isLoading } = usePopularSkills();

  // Apply debounce to search value (300ms)
  const debouncedValue = useDebounce(searchValue, 300);

  // Get skill suggestions
  const suggestions = searchSkills(debouncedValue, existingSkills);

  const handleSelectSkill = (skill: string) => {
    onSelect(skill);
    setSearchValue("");
    // Keep popover open to continue selecting
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        // Select the first suggestion
        handleSelectSkill(suggestions[0].name);
      } else {
        // Add the custom skill if no suggestions found
        handleSelectSkill(searchValue.trim());
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or add skills..."
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : suggestions.length === 0 ? (
              <CommandEmpty>
                {searchValue.trim() ? (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      No skill found.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        if (searchValue.trim()) {
                          handleSelectSkill(searchValue.trim());
                        }
                      }}
                    >
                      Add "{searchValue.trim()}"
                    </Button>
                  </div>
                ) : (
                  "Start typing to search skills..."
                )}
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Select skills">
                {suggestions.map((skill) => {
                  const isSelected = existingSkills.includes(skill.name);
                  return (
                    <CommandItem
                      key={skill.name}
                      value={skill.name}
                      onSelect={() => handleSelectSkill(skill.name)}
                      className="cursor-pointer"
                      disabled={isSelected}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className={isSelected ? "opacity-50" : ""}>
                          {skill.name}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

