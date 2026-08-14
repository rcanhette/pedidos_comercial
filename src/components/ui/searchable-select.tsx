"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  id: string;
  label: string;
  searchText?: string;
  active?: boolean;
};

type SearchableSelectProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  recentIds?: string[];
  placeholder?: string;
  newOption?: { value: string; label: string };
  error?: boolean;
  fieldError?: string;
  disabledValues?: string[];
  required?: boolean;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

export function SearchableSelect({
  name,
  value,
  onChange,
  options,
  placeholder = "Digite para pesquisar",
  newOption,
  error,
  fieldError,
  disabledValues = [],
  required
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = normalizeSearch(query);
  const selected = options.find((option) => option.id === value);
  const disabledSet = useMemo(() => new Set(disabledValues.filter(Boolean)), [disabledValues]);

  const visibleOptions = useMemo(() => {
    const matched = options
      .filter((option) => !normalizedQuery || normalizeSearch(option.searchText ?? option.label).includes(normalizedQuery))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    return matched;
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!open) return;
    function updateMenuRect() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setMenuRect(rect);
    }
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    }
    updateMenuRect();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [open]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} data-field-error={fieldError} className="relative mt-1 space-y-2">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm outline-none", error ? "border-red-500 focus:ring-red-500" : "border-input focus:ring-ring", "focus:ring-2")}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground")}>{selected?.label ?? "Selecione"}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : undefined)} />
      </button>
      {open && menuRect ? createPortal(
        <div
          className="fixed z-[100] rounded-md border bg-background p-2 shadow-lg"
          style={{ left: menuRect.left, top: menuRect.bottom + 4, width: menuRect.width }}
        >
          <div className="mb-2 flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <Input className="h-8 border-0 px-0 focus:ring-0" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border bg-background">
            {newOption && !normalizedQuery ? (
              <button type="button" className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => selectValue(newOption.value)}>
                <span>{newOption.label}</span>
                {value === newOption.value ? <Check size={16} /> : null}
              </button>
            ) : null}
            {visibleOptions.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cadastro encontrado.</p> : null}
            {visibleOptions.map((option) => {
              const disabled = disabledSet.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50", value === option.id ? "bg-muted/70" : undefined)}
                  disabled={disabled}
                  onClick={() => selectValue(option.id)}
                >
                  <span>{option.label}{option.active === false ? " (inativo)" : ""}</span>
                  {value === option.id ? <Check size={16} /> : null}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      ) : null}
      {value ? <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => selectValue("")}>Limpar seleção</Button> : null}
    </div>
  );
}
