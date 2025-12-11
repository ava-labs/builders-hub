"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, ChevronDown } from "lucide-react";
import { hexToCB58, cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter";

type IdFormat = "cb58" | "hex";

interface CopyableIdChipProps {
  label: string;
  value: string;
  className?: string;
}

export function CopyableIdChip({ label, value, className = "" }: CopyableIdChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div 
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${className}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <code 
        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[100px] sm:max-w-[160px]" 
        title={value}
      >
        {value}
      </code>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={`Copy ${label}`}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
        )}
      </button>
    </div>
  );
}

interface FormatToggleIdChipProps {
  label: string;
  /** The original value as stored (subnetId in CB58, blockchainId in hex) */
  value: string;
  /** The original format of the value */
  originalFormat: IdFormat;
  className?: string;
}

export function FormatToggleIdChip({ 
  label, 
  value, 
  originalFormat,
  className = "" 
}: FormatToggleIdChipProps) {
  const [copied, setCopied] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<IdFormat>(originalFormat);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Convert value based on selected format
  const displayValue = useMemo(() => {
    if (selectedFormat === originalFormat) {
      return value;
    }

    try {
      if (originalFormat === "cb58" && selectedFormat === "hex") {
        // Convert CB58 to hex
        const hex = cb58ToHex(value);
        return "0x" + hex;
      } else if (originalFormat === "hex" && selectedFormat === "cb58") {
        // Convert hex to CB58 - strip 0x prefix if present
        const cleanHex = value.startsWith("0x") ? value.slice(2) : value;
        return hexToCB58(cleanHex);
      }
    } catch (error) {
      // If conversion fails, return original value
      console.error("Format conversion failed:", error);
      return value;
    }
    return value;
  }, [value, selectedFormat, originalFormat]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleFormatChange = (format: IdFormat) => {
    setSelectedFormat(format);
    setIsDropdownOpen(false);
  };

  return (
    <div 
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${className}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <code 
        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[100px] sm:max-w-[160px]" 
        title={displayValue}
      >
        {displayValue}
      </code>
      
      {/* Format Toggle Dropdown */}
      <button
        ref={buttonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
      >
        {selectedFormat === "hex" ? "Hex" : "CB58"}
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {isDropdownOpen && typeof document !== "undefined" && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed min-w-[80px] py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999,
          }}
        >
          <button
            onClick={() => handleFormatChange("hex")}
            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
              selectedFormat === "hex" 
                ? "text-zinc-900 dark:text-white font-medium" 
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Hex
          </button>
          <button
            onClick={() => handleFormatChange("cb58")}
            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
              selectedFormat === "cb58" 
                ? "text-zinc-900 dark:text-white font-medium" 
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            CB58
          </button>
        </div>,
        document.body
      )}

      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={`Copy ${label}`}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
        )}
      </button>
    </div>
  );
}

interface ChainIdChipsProps {
  subnetId?: string;
  blockchainId?: string;
  className?: string;
}

export function ChainIdChips({ subnetId, blockchainId, className = "" }: ChainIdChipsProps) {
  if (!subnetId && !blockchainId) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {subnetId && (
        <FormatToggleIdChip 
          label="Subnet" 
          value={subnetId} 
          originalFormat="cb58" 
        />
      )}
      {blockchainId && (
        <FormatToggleIdChip 
          label="Chain" 
          value={blockchainId} 
          originalFormat="hex" 
        />
      )}
    </div>
  );
}

