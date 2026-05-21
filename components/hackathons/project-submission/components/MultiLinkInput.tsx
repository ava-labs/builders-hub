"use client";

import React from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { FormLabelWithCheck } from "./FormLabelWithCheck";
import { isValidHttpUrl, normalizeUrl } from "@/lib/url-validation";

interface MultiLinkInputProps {
  name: string;
  label: string;
  placeholder: string;
  validationMessage?: string;
  /** When true, renders a plain FormLabel instead of FormLabelWithCheck. */
  plainLabel?: boolean;
  /** Optional description rendered between the label and the input. */
  description?: string;
  /** When true, skips domain-origin validation (e.g. allows YouTube/Loom links). */
  allowAllDomains?: boolean;
}

export const MultiLinkInput: React.FC<MultiLinkInputProps> = ({
  name,
  label,
  placeholder,
  validationMessage,
  plainLabel = false,
  description,
  allowAllDomains = false,
}) => {
  const form = useFormContext<FieldValues>();
  const [newLink, setNewLink] = React.useState("");

  const handleAddLink = (): void => {
    const rawInput = newLink.trim();
    if (!rawInput) return;

    const formattedLink = normalizeUrl(rawInput);

    if (!isValidHttpUrl(formattedLink)) {
      form.setError(name, {
        type: "manual",
        message: "Please enter a valid URL (e.g. https://example.com)",
      });
      return;
    }

    const url = new URL(formattedLink);
    if (
      !allowAllDomains &&
      name === "demo_link" &&
      (url.hostname.includes("youtube.com") ||
        url.hostname.includes("youtu.be") ||
        url.hostname.includes("loom.com"))
    ) {
      form.setError(name, {
        type: "manual",
        message: "YouTube and Loom links should be added in the video section",
      });
      return;
    }

    const currentLinks = (form.getValues(name) as string[]) || [];
    if (currentLinks.includes(formattedLink)) {
      form.setError(name, {
        type: "manual",
        message: "This link has already been added",
      });
      return;
    }

    form.clearErrors(name);
    form.setValue(name, [...currentLinks, formattedLink], { shouldValidate: true, shouldDirty: true });
    setNewLink("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === " ") {
      e.preventDefault();
      handleAddLink();
    }
  };

  const handleRemoveLink = (indexToRemove: number) => {
    const currentLinks = (form.getValues(name) as string[]) || [];
    form.setValue(
      name,
      currentLinks.filter((_, index) => index !== indexToRemove)
    );
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          {plainLabel ? (
            <FormLabel>{label}</FormLabel>
          ) : (
            <FormLabelWithCheck
              label={label}
              checked={!!field.value && (field.value as string[]).length > 0}
            />
          )}
          {description && (
            <p className="text-zinc-400 text-sm -mt-1">{description}</p>
          )}
          <FormControl>
            <div className="space-y-2">
              <Input
                placeholder={placeholder}
                value={newLink}
                onChange={(e) => {
                  setNewLink(e.target.value);
                  if (form.formState.errors[name]) {
                    form.clearErrors(name);
                  }
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleAddLink}
                className="w-full"
              />
              <div className="flex flex-wrap gap-2">
                {((field.value as string[]) || []).map((link, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {link}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleRemoveLink(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </FormControl>
          <FormMessage />
        
          {!fieldState.error && validationMessage && (
            <p className="text-zinc-400 text-[14px] leading-[100%] tracking-[0%] font-aeonik">
              {validationMessage}
            </p>
          )}
        </FormItem>
      )}
    />
  );
};
