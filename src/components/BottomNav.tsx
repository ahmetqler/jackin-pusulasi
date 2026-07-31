"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Radar" },
  { href: "/friends", label: "Arkadaşlar" },
  { href: "/settings", label: "Ayarlar" },
] as const;

export default function BottomNav({ badge = 0 }: { badge?: number }) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 border-t border-edge bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`relative flex h-14 items-center justify-center text-sm transition-colors ${
                  active ? "text-accent font-semibold" : "text-muted"
                }`}
              >
                {item.label}
                {item.href === "/friends" && badge > 0 && (
                  <span className="absolute top-3 ml-16 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-background">
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
