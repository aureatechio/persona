"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "bg-emerald-500 hover:bg-emerald-400 text-black font-semibold",
    "shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30",
  ].join(" "),
  secondary: [
    "bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white",
    "border border-white/[0.08] hover:border-white/[0.15]",
  ].join(" "),
  ghost: [
    "bg-transparent hover:bg-white/[0.06] text-zinc-400 hover:text-white",
  ].join(" "),
  danger: [
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300",
    "border border-red-500/20 hover:border-red-500/30",
  ].join(" "),
  outline: [
    "bg-transparent hover:bg-white/[0.04] text-zinc-300 hover:text-white",
    "border border-white/[0.1] hover:border-white/[0.2]",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-5 py-2.5 text-sm gap-2 rounded-xl",
  lg: "px-7 py-3.5 text-base gap-2.5 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconRight,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium",
          "active:scale-[0.97] transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" />
        ) : (
          icon
        )}
        {children}
        {iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
