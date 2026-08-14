"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  FileText,
  Home,
  PackageIcon,
  ShieldCheck,
  TrendingUp,
  User,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSidebarGroupActive, isSidebarItemActive, visibleSidebarMenu, type SidebarMenuGroup, type SidebarMenuItem } from "@/lib/sidebar-menu";

const icons = {
  "bar-chart-3": BarChart3,
  "building-2": Building2,
  "clipboard-list": ClipboardList,
  coins: Coins,
  "file-spreadsheet": FileSpreadsheet,
  "file-text": FileText,
  home: Home,
  package: PackageIcon,
  "shield-check": ShieldCheck,
  "trending-up": TrendingUp,
  user: User,
  users: Users
};

function MenuIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? FileText;
  return <Icon size={size} />;
}

function ItemLink({ item, nested = false }: { item: SidebarMenuItem; nested?: boolean }) {
  const pathname = usePathname();
  const active = isSidebarItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10 hover:text-white",
        nested && "pl-10 text-slate-200",
        active && "bg-white/10 text-white"
      )}
    >
      {!nested ? <MenuIcon name={item.icon} /> : null}
      {item.label}
    </Link>
  );
}

function MenuGroup({ group }: { group: SidebarMenuGroup }) {
  const pathname = usePathname();
  const active = isSidebarGroupActive(pathname, group);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-100 transition-colors hover:bg-white/10 hover:text-white",
          active && "bg-white/10 text-white"
        )}
      >
        <MenuIcon name={group.icon} />
        <span className="min-w-0 flex-1">{group.label}</span>
        <ChevronDown size={16} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-1 space-y-1">
          {group.children.map((item) => (
            <ItemLink key={item.href} item={item} nested />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({ permissions }: { permissions: readonly string[] }) {
  const entries = visibleSidebarMenu({ permissions });

  return (
    <nav className="space-y-1">
      {entries.map((entry) => (entry.type === "item" ? <ItemLink key={entry.href} item={entry} /> : <MenuGroup key={entry.label} group={entry} />))}
    </nav>
  );
}
