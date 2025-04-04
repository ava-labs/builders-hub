import React from "react";

interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: any;
  icon?: React.ReactNode;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const CustomInput: React.FC<CustomInputProps> = ({
  label,
  error,
  icon,
  onBlur,
  ...props
}) => {
  return (
    <div className='my-2 w-full'>
      {label && (
        <label htmlFor={props.id} className='block text-sm mb-2'>
          {label}
          {props.required && <span className='text-[#FB2C36]'>*</span>}
        </label>
      )}
      <div className='relative w-full'>
        <input
          {...props}
          className={`w-full h-10 px-2 rounded-md bg-[var(--default-background-color)] border border-[var(--default-border-color)] text-[var(--primary-text-color)] focus:outline-none focus:border-[#FB2C36] ${props.className}`}
        />{" "}
        {icon && <div className='absolute right-2 top-2'>{icon}</div>}
      </div>
      {error && <p className='text-sm text-[#FB2C36]'>{error.message}</p>}
    </div>
  );
};

export default CustomInput;
