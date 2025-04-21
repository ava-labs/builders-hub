"use client"

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { CircleIcon } from "lucide-react"
import { Label } from "@radix-ui/react-label"
import { cn } from "../lib/utils"

type RadioItem = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type RadioGroupProps = {
  items: RadioItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  idPrefix?: string;
};

function RadioGroup({
  items,
  value,
  onChange,
  className,
  idPrefix = "",
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      value={value}
      onValueChange={onChange}
    >
      {items.map((item) => (
        <div key={item.value} className="flex items-center space-x-2">
          <RadioGroupPrimitive.Item
            value={item.value}
            id={`${idPrefix}${item.value}`}
            disabled={item.isDisabled}
            className={cn(
              "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 disabled:border-dashed disabled:border-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-800 dark:disabled:border-gray-700"
            )}
          >
            <RadioGroupPrimitive.Indicator
              data-slot="radio-group-indicator"
              className="relative flex items-center justify-center"
            >
              <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
            </RadioGroupPrimitive.Indicator>
          </RadioGroupPrimitive.Item>
          <Label htmlFor={`${idPrefix}${item.value}`} className={item.isDisabled ? "text-gray-500" : ""}>
            {item.label}
          </Label>
        </div>
      ))}
    </RadioGroupPrimitive.Root>
  )
}

export { RadioGroup }
