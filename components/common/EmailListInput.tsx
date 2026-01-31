 "use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type EmailListInputProps = {
  value: string[];
  onChange: (emails: string[]) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function EmailListInput({
  value,
  onChange,
  label,
  description,
  placeholder = "Add email...",
  disabled = false,
}: EmailListInputProps) {
  const [newEmail, setNewEmail] = useState("");

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!validateEmail(trimmed)) return;
    if (value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-zinc-200">
          {label}
        </label>
      )}
      {description && (
        <p className="text-xs text-zinc-400">{description}</p>
      )}
      <div
        className="flex flex-wrap items-center gap-2 bg-zinc-950 px-3 py-2 rounded-md min-h-[42px] focus-within:ring-2 focus-within:ring-zinc-600 border border-zinc-700"
        onClick={() => {
          const input = document.getElementById("email-list-input") as HTMLInputElement | null;
          input?.focus();
        }}
      >
        {value.map((email) => (
          <div
            key={email}
            className="flex items-center bg-transparent text-white text-sm rounded-full px-2 py-1"
          >
            <span className="text-zinc-300">{email}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-2 h-4 w-4 text-zinc-400 hover:text-red-400 p-0"
                onClick={() => handleRemoveEmail(email)}
              >
                ✕
              </Button>
            )}
          </div>
        ))}

        {!disabled && (
          <input
            id="email-list-input"
            type="email"
            value={newEmail}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "Tab") {
                e.preventDefault();
                handleAddEmail();
              }
            }}
            placeholder={value.length === 0 ? placeholder : ""}
            className="text-sm outline-none flex-1 min-w-[120px] py-1 px-3 bg-transparent text-zinc-100 placeholder-zinc-500"
          />
        )}
      </div>
    </div>
  );
}

