"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  normalizeUppercase?: boolean;
};

function normalizeInputValue(value: string) {
  return value.toLocaleUpperCase("pt-BR");
}

export function Input({ normalizeUppercase, onChange, className, type, ...props }: InputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (normalizeUppercase) event.currentTarget.value = normalizeInputValue(event.currentTarget.value);
    onChange?.(event);
  }

  return (
    <input
      {...props}
      type={type}
      onChange={handleChange}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}
