"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "glass" | "elevated" | "interactive" | "gradient-border";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: [
    "bg-white/[0.03] border border-white/[0.06]",
    "rounded-2xl",
  ].join(" "),
  glass: [
    "bg-white/[0.03] backdrop-blur-2xl",
    "border border-white/[0.08]",
    "rounded-2xl",
  ].join(" "),
  elevated: [
    "bg-zinc-900/80 backdrop-blur-xl",
    "border border-white/[0.06]",
    "shadow-xl shadow-black/20",
    "rounded-2xl",
  ].join(" "),
  interactive: [
    "bg-white/[0.03] hover:bg-white/[0.06]",
    "border border-white/[0.06] hover:border-white/[0.12]",
    "shadow-xl shadow-black/20 hover:shadow-2xl",
    "rounded-2xl cursor-pointer",
    "hover:-translate-y-1",
    "transition-all duration-300 ease-out",
  ].join(" "),
  "gradient-border": [
    "gradient-border",
    "bg-zinc-950 rounded-2xl",
  ].join(" "),
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", noPadding = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantStyles[variant],
          !noPadding && "p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold text-white tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-zinc-500", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export { Card, CardHeader, CardTitle, CardDescription, type CardProps, type CardVariant };
