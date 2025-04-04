// import React, { useRef, useState, useEffect } from "react";

// interface VerificationInputProps {
//   length?: number;
//   onChange: (code: string) => void;
//   isError?: boolean;
//   autoFocus?: boolean;
//   className?: string;
// }

// export const VerificationInput: React.FC<VerificationInputProps> = ({
//   length = 6,
//   onChange,
//   isError = false,
//   autoFocus = true,
//   className = "",
// }) => {
//   // State to track values of each input box
//   const [code, setCode] = useState<string[]>(Array(length).fill(""));

//   // Create refs for each input element
//   const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

//   // Initialize refs array
//   useEffect(() => {
//     inputRefs.current = inputRefs.current.slice(0, length);
//   }, [length]);

//   // Update parent component when code changes
//   useEffect(() => {
//     onChange(code.join(""));
//   }, [code, onChange]);

//   // Handle input change
//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement>,
//     index: number
//   ) => {
//     const value = e.target.value;

//     // Only accept single characters
//     if (value.length > 1) return;

//     // Update the code array
//     const newCode = [...code];
//     newCode[index] = value;
//     setCode(newCode);

//     // Auto-focus next input if a value was entered
//     if (value !== "" && index < length - 1) {
//       inputRefs.current[index + 1]?.focus();
//     }
//   };

//   // Handle key press
//   const handleKeyDown = (
//     e: React.KeyboardEvent<HTMLInputElement>,
//     index: number
//   ) => {
//     // Move to previous input on backspace if current input is empty
//     if (e.key === "Backspace" && !code[index] && index > 0) {
//       inputRefs.current[index - 1]?.focus();
//     }

//     // Handle arrow keys
//     if (e.key === "ArrowLeft" && index > 0) {
//       e.preventDefault();
//       inputRefs.current[index - 1]?.focus();
//     }

//     if (e.key === "ArrowRight" && index < length - 1) {
//       e.preventDefault();
//       inputRefs.current[index + 1]?.focus();
//     }
//   };

//   // Handle paste event
//   const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
//     e.preventDefault();
//     const pastedData = e.clipboardData.getData("text/plain").trim();

//     // If pasted data matches expected length, fill all fields
//     if (pastedData.length === length && /^\d+$/.test(pastedData)) {
//       const newCode = pastedData.split("");
//       setCode(newCode);

//       // Focus the last input
//       inputRefs.current[length - 1]?.focus();
//     }
//   };

//   return (
//     <div className={`flex gap-4 ${className}`}>
//       {Array.from({ length }, (_, index) => (
//         <div key={index} className='relative'>
//           <input
//             ref={(el) => {
//               inputRefs.current[index] = el;
//             }}
//             type='text'
//             maxLength={1}
//             value={code[index] || ""}
//             onChange={(e) => handleChange(e, index)}
//             onKeyDown={(e) => handleKeyDown(e, index)}
//             onPaste={handlePaste}
//             autoFocus={autoFocus && index === 0}
//             className={`
//               w-full h-12
//               flex items-center justify-center
//               text-lg md:text-xl text-center
//               bg-transparent
//               border-2 rounded-lg border-[#27272A]
//               focus:outline-none focus:ring-2 focus:ring-opacity-50
//               transition-colors uppercase
//               ${
//                 isError
//                   ? "border-[#E11D48] focus:border-[#E11D48] focus:ring-[#E11D48]"
//                   : "border-[#27272A] focus:border-[#FAFAFA] focus:ring-[#FAFAFA]"
//               }
//               text-[#FAFAFA]
//             `}
//             aria-label={`Verification code digit ${index + 1}`}
//           />
//         </div>
//       ))}
//     </div>
//   );
// };



import React, { useRef, useState, useEffect } from "react";

interface VerificationInputProps {
  length?: number;
  onChange: (code: string) => void;
  isError?: boolean;
  autoFocus?: boolean;
  className?: string;
  numbersOnly?: boolean;
}

export const VerificationInput: React.FC<VerificationInputProps> = ({
  length = 6,
  onChange,
  isError = false,
  autoFocus = true,
  className = "",
  numbersOnly = false,
}) => {
  const [code, setCode] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  useEffect(() => {
    onChange(code.join(""));
  }, [code, onChange]);

  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    let pastedData = "";
    try {
      pastedData = e.clipboardData?.getData("text") || "";
    } catch (error) {
      console.error("Error accessing clipboard data:", error);
      return;
    }
    
    pastedData = pastedData.trim();
    
    let filteredChars;
    if (numbersOnly) {
      filteredChars = pastedData.replace(/[^0-9]/g, "").slice(0, length);
    } else {
      filteredChars = pastedData.replace(/[^a-zA-Z0-9]/g, "").slice(0, length);
    }
    
    if (filteredChars.length > 0) {
      const newCode = Array(length).fill("");
      
      for (let i = 0; i < Math.min(filteredChars.length, length); i++) {
        newCode[i] = filteredChars[i];
      }
      
      setCode(newCode);
      
      setTimeout(() => {
        const focusIndex = Math.min(filteredChars.length, length - 1);
        inputRefs.current[focusIndex]?.focus();
      }, 0);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const value = e.target.value;
    
    const char = value.slice(-1);

    const isValid = numbersOnly 
      ? /^\d$/.test(char) 
      : /^[a-zA-Z0-9]$/.test(char);

    if (char && isValid) {
      const newCode = [...code];
      newCode[index] = char.toUpperCase(); 
      setCode(newCode);

      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (value === "") {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      if (code[index] === "") {
        if (index > 0) {
          e.preventDefault();
          inputRefs.current[index - 1]?.focus();
          
          const newCode = [...code];
          newCode[index - 1] = "";
          setCode(newCode);
        }
      }
    } 
    else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } 
    else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (containerRef.current) {
      handleContainerPaste(e as unknown as React.ClipboardEvent<HTMLDivElement>);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`flex gap-4 ${className}`}
      onPaste={handleContainerPaste}
      tabIndex={-1} 
    >
      {Array.from({ length }, (_, index) => (
        <div key={index} className="relative">
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode={numbersOnly ? "numeric" : "text"}
            pattern={numbersOnly ? "[0-9]*" : "[a-zA-Z0-9]*"}
            maxLength={1}
            value={code[index] || ""}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handleInputPaste}
            autoFocus={autoFocus && index === 0}
            className={`
              w-full h-12
              flex items-center justify-center
              text-lg md:text-xl text-center text-white
              bg-transparent
              border-2 rounded-lg border-[var(--default-border-color)]
              focus:outline-none focus:ring-2 focus:ring-opacity-50
              transition-colors uppercase
              ${
                isError
                  ? "border-[#E11D48] focus:border-[#E11D48] focus:ring-[#E11D48]"
                  : "border-[var(--default-border-color)] focus:border-[var(--primary-text-color)] focus:ring-[var(--primary-text-color)]"
              }
              text-[var(--primary-text-color)]
            `}
            aria-label={`Verification code digit ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
};