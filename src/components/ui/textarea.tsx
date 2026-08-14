"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  normalizeUppercase?: boolean;
};

export function Textarea({ normalizeUppercase, onChange, className, ...props }: TextareaProps) {
  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (normalizeUppercase) event.currentTarget.value = event.currentTarget.value.toLocaleUpperCase("pt-BR");
    onChange?.(event);
  }

  return (
    <textarea
      {...props}
      onChange={handleChange}
      className={cn(
        "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    />
  );
}
