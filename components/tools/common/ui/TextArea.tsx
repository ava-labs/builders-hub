import { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  isValid?: boolean;
}

export default function TextArea({ isValid = true, ...props }: TextAreaProps) {
  return (
    <textarea
      className={`w-full p-2 border rounded-md font-mono bg-gray-50 dark:bg-gray-800  ${
        isValid ? "border-green-400 dark:border-green-600" : "border-gray-200 dark:border-gray-600"
      }`}
      {...props}
    />
  );
}
