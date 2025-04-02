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
        className={`w-full h-10 px-2 rounded-md bg-[#09090B] border border-[#27272A] text-[#FAFAFA] focus:outline-none focus:border-[#FB2C36] ${props.className}`}
      >
        {children}
      </select>
    </div>
  );
};

export default CustomSelect;
