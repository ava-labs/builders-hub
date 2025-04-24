"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
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
import { SubmissionForm } from "../hooks/useSubmissionForm";
import { FormLabelWithCheck } from "./FormLabelWithCheck";

interface MultiLinkInputProps {
  name: keyof SubmissionForm;
  label: string;
  placeholder: string;
  validationMessage?: string;
}

export const MultiLinkInput: React.FC<MultiLinkInputProps> = ({
  name,
  label,
  placeholder,
  validationMessage,
}) => {
  const form = useFormContext<SubmissionForm>();
  const [newLink, setNewLink] = React.useState("");

  const handleAddLink = async () => {
    if (!newLink) return;

    const currentLinks = (form.getValues(name) as string[]) || [];
    form.setValue(name, [...currentLinks, newLink], { shouldValidate: true });
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
          <FormLabelWithCheck
            label={label}
            checked={!!field.value && (field.value as string[]).length > 0}
          />
          <FormControl>
            <div className="space-y-2">
              <Input
                placeholder={placeholder}
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={handleKeyDown}
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
