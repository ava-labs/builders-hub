import React from "react";

interface CustomSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  children,
  ...props
}) => {
  return (
    <div className='my-2'>
      {label && (
        <label htmlFor={props.id} className='block text-sm mb-2'>
          {label}
          {props.required && <span className='text-[#FB2C36]'>*</span>}
        </label>
      )}
      <select
        {...props}
        className={`w-full h-10 px-2 rounded-md bg-[var(--default-background-color)] border border-[var(--default-border-color)] text-[var(--primary-text-color)] focus:outline-none focus:border-[#FB2C36] ${props.className}`}
      >
        {children}
      </select>
    </div>
  );
};

export default CustomSelect;
