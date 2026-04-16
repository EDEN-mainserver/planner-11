import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-[#6C63FF] hover:bg-[#4B44CC] text-white",
  dark: "bg-[#111111] hover:bg-[#333] text-white",
  outline:
    "border border-[#E5E5EF] bg-white hover:bg-[#F4F4F8] text-[#111111]",
};

export default function Button({
  variant = "primary",
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "h-12 px-6 rounded-[12px] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        styles[variant],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
