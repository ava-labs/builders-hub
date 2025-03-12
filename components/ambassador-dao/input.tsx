import React from "react";

interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const CustomInput: React.FC<CustomInputProps> = ({ label, ...props }) => {
  return (
    <div className="my-2">
      {label && (
        <label htmlFor={props.id} className="block text-sm mb-2">
          {label}
          {props.required && <span className="text-[#FB2C36]">*</span>}
        </label>
      )}
      <input
        {...props}
        className={`w-full h-10 px-2 rounded-md bg-[#09090B] border border-[#27272A] text-[#FAFAFA] focus:outline-none focus:border-[#FB2C36] ${props.className}`}
      />
    </div>
  );
};

export default CustomInput;
