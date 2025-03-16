import clsx from "clsx";
import { ButtonHTMLAttributes, FC, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  variant?: "default" | "outlined" | "danger";
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
    default: "bg-[#FAFAFA] text-[#09090B]",
    outlined: "bg-transparent border border-[#27272A] text-[#FAFAFA]",
    danger: "bg-[#FB2C36] text-[#FAFAFA]",
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
          className='animate-spin'
          color={variant === "default" ? "#09090B" : "#FAFAFA"}
          size={20}
        />
      ) : (
        children
      )}
    </button>
  );
};

export default CustomButton;
