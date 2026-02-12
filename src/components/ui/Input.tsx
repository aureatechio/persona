"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, className, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3",
            "bg-white/[0.04] hover:bg-white/[0.06]",
            "border outline-none",
            error
              ? "border-red-500/50 focus:border-red-500/70 focus:ring-2 focus:ring-red-500/20"
              : "border-white/[0.08] focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20",
            "rounded-xl text-sm text-white placeholder:text-zinc-600",
            "transition-all duration-200",
            icon && "pl-10",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input, type InputProps };
