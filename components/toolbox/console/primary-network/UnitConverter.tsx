'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import Link from 'next/link';

const metadata: ConsoleToolMetadata = {
  title: 'AVAX Unit Converter',
  description: (
    <>
      Convert between{' '}
      <Link href="/docs/rpcs/c-chain/api" className="text-primary hover:underline">
        C-Chain
      </Link>{' '}
      wei (10<sup>-18</sup>),{' '}
      <Link href="/docs/rpcs/p-chain/api" className="text-primary hover:underline">
        P-Chain
      </Link>{' '}
      nAVAX (10<sup>-9</sup>), and AVAX. Type in any field to convert.
    </>
  ),
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const units = [
  { id: 'AVAX', label: 'AVAX', sublabel: '1', factor: BigInt('1000000000000000000'), step: '0.01' },
  { id: 'nAVAX', label: 'nAVAX', sublabel: 'P-Chain base unit', factor: BigInt('1000000000'), step: '1' },
  { id: 'wei', label: 'Wei', sublabel: 'C-Chain base unit', factor: BigInt('1'), step: '1' },
] as const;

function convertUnits(inputAmount: string, fromUnit: string): Record<string, string> | null {
  if (!inputAmount || isNaN(Number(inputAmount))) return null;

  const sourceUnit = units.find((u) => u.id === fromUnit);
  if (!sourceUnit) return null;

  let baseAmount: bigint;
  try {
    if (inputAmount.includes('.')) {
      const [whole, decimal] = inputAmount.split('.');
      const wholeValue = whole === '' ? BigInt(0) : BigInt(whole);
      const wholeInWei = wholeValue * sourceUnit.factor;
      const decimalPlaces = decimal.length;
      const decimalValue = BigInt(decimal);
      const decimalFactor = sourceUnit.factor / BigInt(10 ** decimalPlaces);
      baseAmount = wholeInWei + decimalValue * decimalFactor;
    } else {
      baseAmount = BigInt(inputAmount) * sourceUnit.factor;
    }
  } catch {
    return null;
  }

  const results: Record<string, string> = {};
  for (const unit of units) {
    if (baseAmount === BigInt(0)) {
      results[unit.id] = '0';
      continue;
    }
    const quotient = baseAmount / unit.factor;
    const remainder = baseAmount % unit.factor;
    if (remainder === BigInt(0)) {
      results[unit.id] = quotient.toString();
    } else {
      const decimalPart = remainder.toString().padStart(unit.factor.toString().length - 1, '0');
      results[unit.id] = `${quotient}.${decimalPart.replace(/0+$/, '')}`;
    }
  }
  return results;
}

function UnitConverterInner(_props: BaseConsoleToolProps) {
  const [amount, setAmount] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('AVAX');
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const converted = convertUnits(amount, selectedUnit);
    if (converted) setResults(converted);
  }, [amount, selectedUnit]);

  const handleCopy = useCallback((value: string, unitId: string) => {
    navigator.clipboard.writeText(value);
    setCopied(unitId);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="space-y-2">
      {units.map((unit) => {
        const value = unit.id === selectedUnit ? amount : (results[unit.id] ?? '');
        const isSource = unit.id === selectedUnit;

        return (
          <div key={unit.id} className="group">
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{unit.label}</span>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{unit.sublabel}</div>
              </div>

              <div className="flex-1 flex items-center rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) {
                      setAmount(v);
                      setSelectedUnit(unit.id);
                    }
                  }}
                  placeholder="0"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none min-w-0"
                />
                <button
                  onClick={() => handleCopy(value, unit.id)}
                  className="px-2.5 py-2.5 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
                  aria-label={`Copy ${unit.label} value`}
                >
                  {copied === unit.id ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="pt-2 flex items-center gap-3">
        <div className="w-20 shrink-0" />
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          1 AVAX = 10<sup>9</sup> nAVAX = 10<sup>18</sup> wei
        </p>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(UnitConverterInner, metadata);
