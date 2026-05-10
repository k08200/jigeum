"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`text-[13px] px-2.5 py-1.5 rounded-md transition-colors ${
        isActive
          ? "text-white bg-stone-800/80 font-medium"
          : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
