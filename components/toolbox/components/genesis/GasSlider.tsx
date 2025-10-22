"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { Info } from 'lucide-react';

interface GasSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  presets?: { label: string; value: number; description?: string }[];
  formatValue?: (value: number) => string;
  error?: string;
  warning?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  showInput?: boolean;
  logarithmic?: boolean;
}

export function GasSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  description,
  presets,
  formatValue,
  error,
  warning,
  onFocus,
  onBlur,
  showInput = true,
  logarithmic = false
}: GasSliderProps) {
  const [localValue, setLocalValue] = useState(value.toString());
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value.toString());
    }
  }, [value, isDragging]);

  // Convert between linear slider position and logarithmic value
  const toSliderValue = (val: number) => {
    if (!logarithmic) return val;
    if (val <= 0) return min;
    const minLog = Math.log(min || 1);
    const maxLog = Math.log(max);
    return (Math.log(val) - minLog) / (maxLog - minLog) * (max - min) + min;
  };

  const fromSliderValue = (sliderVal: number) => {
    if (!logarithmic) return sliderVal;
    const minLog = Math.log(min || 1);
    const maxLog = Math.log(max);
    const scale = (sliderVal - min) / (max - min);
    return Math.exp(minLog + scale * (maxLog - minLog));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = logarithmic ? Math.round(fromSliderValue(sliderValue)) : sliderValue;
    setLocalValue(actualValue.toString());
    onChange(actualValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal >= min && numVal <= max) {
      onChange(numVal);
    }
  };

  const handleInputBlur = () => {
    const numVal = parseFloat(localValue);
    if (isNaN(numVal) || numVal < min) {
      setLocalValue(min.toString());
      onChange(min);
    } else if (numVal > max) {
      setLocalValue(max.toString());
      onChange(max);
    } else {
      onChange(numVal);
    }
    onBlur?.();
  };

  const percentage = ((logarithmic ? toSliderValue(value) : value) - min) / (max - min) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toLocaleString();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
          {description && (
            <div className="group relative">
              <Info className="h-3 w-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-help" />
              <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-64 p-2 bg-zinc-950 text-zinc-100 text-[11px] rounded-md shadow-lg border border-zinc-800">
                {description}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showInput ? (
            <input
              type="text"
              value={localValue}
              onChange={handleInputChange}
              onFocus={onFocus}
              onBlur={handleInputBlur}
              className={cn(
                "w-24 px-2 py-1 text-[12px] text-right rounded-md font-mono",
                "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800",
                "focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600",
                "text-zinc-700 dark:text-zinc-300",
                error && "border-red-500 focus:ring-red-500"
              )}
            />
          ) : (
            <span className="text-[12px] font-mono font-medium text-zinc-700 dark:text-zinc-300">
              {displayValue}
            </span>
          )}
          {unit && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{unit}</span>
          )}
        </div>
      </div>

      {/* Slider Track */}
      <div className="relative">
        <div className="relative h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div
            className="absolute h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Slider Input */}
          <input
            type="range"
            min={logarithmic ? min : min}
            max={logarithmic ? max : max}
            step={logarithmic ? 1 : step}
            value={logarithmic ? toSliderValue(value) : value}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            onFocus={onFocus}
            onBlur={() => {
              setIsDragging(false);
              onBlur?.();
            }}
            className={cn(
              "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
              "focus:outline-none"
            )}
          />
        </div>

        {/* Thumb */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full",
            "bg-white dark:bg-zinc-950 border-2 border-blue-500 dark:border-blue-400 shadow-sm",
            "pointer-events-none transition-transform",
            isDragging && "scale-110"
          )}
          style={{ left: `calc(${percentage}% - 7px)` }}
        />
      </div>

      {/* Preset Buttons */}
      {presets && presets.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded-md transition-colors font-medium",
                "border border-zinc-200 dark:border-zinc-800",
                value === preset.value
                  ? "bg-blue-500 dark:bg-blue-500 text-white dark:text-white border-blue-500 dark:border-blue-500"
                  : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              )}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Error/Warning Messages */}
      {error && (
        <div className="text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1">
          {error}
        </div>
      )}
      {!error && warning && (
        <div className="text-[11px] text-amber-600 dark:text-amber-500 flex items-center gap-1">
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
}
