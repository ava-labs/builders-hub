"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

// Opciones disponibles

export type trackProp={
  value:string,
  label:string
}

interface MultiSelectTrackProps {
  value: string[];
  onChange: (value: string[]) => void;
  tracks:trackProp[]
}

// Puedes usar una función simple para concatenar clases
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export function MultiSelectTrack({ value, onChange, tracks }: MultiSelectTrackProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredTracks = tracks.filter((track) =>
    track.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (trackValue: string) => {
    if (value.includes(trackValue)) {
      onChange(value.filter((v) => v !== trackValue));
    } else {
      onChange([...value, trackValue]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-zinc-400"
        >
          {value.length > 0
            ? value
                .map((v) => tracks.find((t) => t.value === v)?.label)
                .join(", ")
            : "Select Track"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full p-0 "
      >
        <Command className="dark:bg-zinc-950 ">

          <CommandInput 
            placeholder="Search track..."
            value={query}
            onValueChange={setQuery} 
            
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {filteredTracks.map((track) => (
              <CommandItem
                key={track.value}
                onSelect={() => {
                  handleSelect(track.value);
                  setQuery("");
                }}
              >
                <Check
                 className={cn(
                    "mr-2 h-4 w-4",
                    "border rounded-md",
                    value.includes(track.value)
                      ? "bg-zinc-50 "
                      : "dark:bg-zinc-800  dark:border-zinc-50"
                  )}
                  color={cn(
                    value.includes(track.value)?'black':'transparent'
                  )}
                  />
                {track.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
