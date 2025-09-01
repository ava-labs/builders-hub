import clsx from "clsx";
import { ButtonHTMLAttributes, FC, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  variant?: "default" | "outlined" | "danger" | "white";
  disabled?: boolean;
  isFullWidth?: boolean;
  className?: string;
};

const CustomButton: FC<ButtonProps> = ({
  children,
  onClick,
  isLoading,
  type = "button",
  variant = "default",
  disabled,
  isFullWidth = true,
  className,
}) => {
  const baseClasses =
    "rounded-md h-10 text-sm font-medium flex items-center justify-center gap-2 transition focus:outline-none";

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default: "bg-[#18181B] dark:bg-[#FAFAFA] text-[#fff] dark:text-[#09090B]",
    outlined:
      "bg-transparent border border-[var(--default-border-color)] text-[var(--primary-text-color)]",
    danger: "bg-[#FB2C36] text-[#fafafa]",
    white: "bg-[#000] text-[#fff] dark:bg-[#F5F5F9] dark:text-[#161617]",
  };

  return (
    <button
      type={type}
      className={clsx(
        baseClasses,
        variants[variant],
        disabled && "opacity-50 cursor-not-allowed",
        isFullWidth && "w-full",
        className
      )}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2
          className="animate-spin"
          color={
            variant === "default"
              ? "var(--default-background-color)"
              : variant === "white"
              ? "var(--default-background-color)"
              : variant === "danger"
              ? "#fff"
              : variant === "outlined"
              ? "#000"
              : "currentColor"
          }
          size={20}
        />
      ) : (
        children
      )}
    </button>
  );
};

export default CustomButton;
