"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onChange' | 'onCheckedChange'> {
    label?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
    ({ className, label, onChange, id: providedId, ...props }, ref) => {
        const internalId = React.useId();
        const id = providedId || internalId;

        return (
            <div className={cn("flex items-center mb-4", className)}>
                <CheckboxPrimitive.Root
                    ref={ref}
                    id={id}
                    className={cn(
                        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                    )}
                    onCheckedChange={(checked) => {
                        // Radix sends boolean | 'indeterminate'. We simplify to boolean.
                        if (onChange) {
                            onChange(checked === true);
                        }
                    }}
                    {...props}
                >
                    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
                        <Check className="h-4 w-4" />
                    </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                {label && (
                    <label
                        htmlFor={id}
                        className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {label}
                    </label>
                )}
            </div>
        );
    }
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
