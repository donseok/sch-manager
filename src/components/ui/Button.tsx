"use client";

import { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-800",
  secondary:
    "bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-500",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300 dark:bg-red-500 dark:hover:bg-red-600",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-400 disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-700 dark:disabled:text-slate-600",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-base",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export default function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed dark:focus:ring-offset-slate-900",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
