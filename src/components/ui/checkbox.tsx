"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onChange, onCheckedChange, ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState<boolean>(
      Boolean(defaultChecked ?? false)
    );

    const isCurrentChecked = isControlled ? Boolean(checked) : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextChecked = e.target.checked;
      if (!isControlled) {
        setInternalChecked(nextChecked);
      }
      onChange?.(e);
      onCheckedChange?.(nextChecked);
    };

    return (
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 dark:border-slate-700 bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer",
            isCurrentChecked && "bg-primary border-primary text-primary-foreground",
            className
          )}
          aria-hidden="true"
        >
          {isCurrentChecked && <Check className="h-3 w-3 stroke-[3]" />}
        </span>
      </span>
    );
  }
);

Checkbox.displayName = "Checkbox";
