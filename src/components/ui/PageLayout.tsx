"use client";

import { cn } from "@/lib/utils";
import { GlowOrbs } from "./GlowOrbs";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  withOrbs?: boolean;
  className?: string;
}

export function PageLayout({
  children,
  title,
  description,
  actions,
  withOrbs = false,
  className,
}: PageLayoutProps) {
  return (
    <div className={cn("relative flex-1 overflow-y-auto", className)}>
      {withOrbs && <GlowOrbs />}
      <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {(title || actions) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
            <div>
              {title && (
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-zinc-500 mt-1.5 text-sm md:text-base">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
