"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Loader2 } from "lucide-react";
import { keccak256, toBytes } from "viem";

interface ContractReadSectionProps {
  abi: any[];
  address: string;
  rpcUrl?: string;
  themeColor?: string;
}

interface FunctionResult {
  loading: boolean;
  result?: string;
  error?: string;
}

// Get read-only functions from ABI
function getReadFunctions(abi: any[]): any[] {
  return abi.filter(item => 
    item.type === 'function' && 
    (item.stateMutability === 'view' || item.stateMutability === 'pure')
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Simple ABI parameter encoder
function encodeParameter(type: string, value: string): string {
  try {
    if (type === 'address') {
      return value.toLowerCase().replace('0x', '').padStart(64, '0');
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
      const num = BigInt(value);
      return num.toString(16).padStart(64, '0');
    }
    if (type === 'bool') {
      return (value.toLowerCase() === 'true' || value === '1') ? '1'.padStart(64, '0') : '0'.padStart(64, '0');
    }
    if (type === 'bytes32') {
      return value.replace('0x', '').padEnd(64, '0');
    }
    return value.replace('0x', '').padStart(64, '0');
  } catch {
    return '0'.padStart(64, '0');
  }
}

// Simple ABI result decoder
function decodeResult(rawResult: string, outputs: any[]): string {
  if (!rawResult || rawResult === '0x') return 'null';
  
  const data = rawResult.slice(2);
  
  if (outputs.length === 0) return rawResult;
  
  if (outputs.length === 1) {
    const outputType = outputs[0].type;
    try {
      if (outputType === 'string') {
        const offset = parseInt(data.slice(0, 64), 16) * 2;
        const length = parseInt(data.slice(offset, offset + 64), 16);
        const hexStr = data.slice(offset + 64, offset + 64 + length * 2);
        let str = '';
        for (let i = 0; i < hexStr.length; i += 2) {
          const charCode = parseInt(hexStr.slice(i, i + 2), 16);
          if (charCode === 0) break;
          str += String.fromCharCode(charCode);
        }
        return str || '""';
      }
      if (outputType === 'bool') {
        return parseInt(data.slice(0, 64), 16) === 1 ? 'true' : 'false';
      }
      if (outputType.startsWith('uint')) {
        const num = BigInt('0x' + data.slice(0, 64));
        return num.toString();
      }
      if (outputType.startsWith('int')) {
        const num = BigInt('0x' + data.slice(0, 64));
        if (num >= BigInt('0x8000000000000000000000000000000000000000000000000000000000000000')) {
          return (num - BigInt('0x10000000000000000000000000000000000000000000000000000000000000000')).toString();
        }
        return num.toString();
      }
      if (outputType === 'address') {
        return '0x' + data.slice(24, 64);
      }
      if (outputType === 'bytes32') {
        return '0x' + data.slice(0, 64);
      }
      if (outputType.startsWith('bytes')) {
        const offset = parseInt(data.slice(0, 64), 16) * 2;
        const length = parseInt(data.slice(offset, offset + 64), 16);
        return '0x' + data.slice(offset + 64, offset + 64 + length * 2);
      }
    } catch {
      return rawResult;
    }
  }
  
  // Multiple outputs
  try {
    const results: string[] = [];
    let offset = 0;
    for (const output of outputs) {
      const chunk = data.slice(offset, offset + 64);
      const name = output.name || `output${results.length}`;
      if (output.type === 'address') {
        results.push(`${name}: 0x${chunk.slice(24)}`);
      } else if (output.type.startsWith('uint') || output.type.startsWith('int')) {
        results.push(`${name}: ${BigInt('0x' + chunk).toString()}`);
      } else if (output.type === 'bool') {
        results.push(`${name}: ${parseInt(chunk, 16) === 1 ? 'true' : 'false'}`);
      } else {
        results.push(`${name}: 0x${chunk}`);
      }
      offset += 64;
    }
    return results.join('\n');
  } catch {
    return rawResult;
  }
}

// Compute function selector using keccak256
function getFunctionSelector(signature: string): string {
  const hash = keccak256(toBytes(signature));
  return hash.slice(2, 10); // First 4 bytes (8 hex chars)
}

export default function ContractReadSection({
  abi,
  address,
  rpcUrl,
  themeColor = "#E57373",
}: ContractReadSectionProps) {
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, string>>>({});
  const [functionResults, setFunctionResults] = useState<Record<string, FunctionResult>>({});

  const readFunctions = getReadFunctions(abi);

  const toggleFunction = (funcKey: string) => {
    setExpandedFunctions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(funcKey)) {
        newSet.delete(funcKey);
      } else {
        newSet.add(funcKey);
      }
      return newSet;
    });
  };

  const updateInput = (funcKey: string, inputName: string, value: string) => {
    setFunctionInputs(prev => ({
      ...prev,
      [funcKey]: {
        ...(prev[funcKey] || {}),
        [inputName]: value
      }
    }));
  };

  const callFunction = async (func: any, funcKey: string) => {
    if (!rpcUrl) {
      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: 'No RPC URL configured' }
      }));
      return;
    }

    setFunctionResults(prev => ({
      ...prev,
      [funcKey]: { loading: true }
    }));

    try {
      const inputs = func.inputs || [];
      const inputValues = functionInputs[funcKey] || {};

      // Build function signature
      const inputTypes = inputs.map((i: any) => i.type).join(',');
      const signature = `${func.name}(${inputTypes})`;

      // Get selector using keccak256
      const selector = getFunctionSelector(signature);

      // Build call data
      let callData = '0x' + selector;
      
      for (const input of inputs) {
        const value = inputValues[input.name || `param${inputs.indexOf(input)}`];
        if (value === undefined || value === '') {
          throw new Error(`Missing value for: ${input.name || 'parameter'}`);
        }
        callData += encodeParameter(input.type, value);
      }

      // Make eth_call
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: address, data: callData }, 'latest'],
          id: 1
        })
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'RPC call failed');
      }

      const decoded = decodeResult(result.result, func.outputs || []);

      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, result: decoded }
      }));
    } catch (err) {
      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: err instanceof Error ? err.message : 'Call failed' }
      }));
    }
  };

  // Warning: No RPC URL
  if (!rpcUrl) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">RPC Not Available</span>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              No RPC URL is configured for this chain. Contract read functionality is not available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warning: No read functions
  if (readFunctions.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <AlertCircle className="w-5 h-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No Read Functions</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              This contract has no public view or pure functions available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {readFunctions.map((func, index) => {
        const funcKey = `${func.name}-${index}`;
        const isExpanded = expandedFunctions.has(funcKey);
        const inputs = func.inputs || [];
        const outputs = func.outputs || [];
        const result = functionResults[funcKey];

        return (
          <div key={funcKey}>
            {/* Function Header */}
            <button
              onClick={() => toggleFunction(funcKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{func.name}</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {/* Function Body */}
            {isExpanded && (
              <div className="px-4 py-4 bg-zinc-50/50 dark:bg-zinc-800/20 space-y-4">
                {/* Inputs */}
                {inputs.length > 0 && (
                  <div className="space-y-3">
                    {inputs.map((input: any, inputIndex: number) => (
                      <div key={inputIndex}>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          {input.name || `param${inputIndex}`} 
                          <span className="text-zinc-400 dark:text-zinc-500 ml-1">({input.type})</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter ${input.type}`}
                          value={functionInputs[funcKey]?.[input.name || `param${inputIndex}`] || ''}
                          onChange={(e) => updateInput(funcKey, input.name || `param${inputIndex}`, e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 text-zinc-900 dark:text-white placeholder-zinc-400"
                          style={{ '--tw-ring-color': themeColor } as any}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Query Button and Output Types */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => callFunction(func, funcKey)}
                    disabled={result?.loading}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    style={{ backgroundColor: themeColor }}
                  >
                    {result?.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {result?.loading ? 'Querying...' : 'Query'}
                  </button>
                  
                  {/* Output Types */}
                  {outputs.length > 0 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      → {outputs.map((o: any) => `${o.name || 'result'} (${o.type})`).join(', ')}
                    </span>
                  )}
                </div>

                {/* Result */}
                {result && !result.loading && (
                  <div>
                    {result.error ? (
                      <div className="p-3 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                        {result.error}
                      </div>
                    ) : (
                      <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">Result</div>
                        <div className="text-sm font-mono text-zinc-900 dark:text-white break-all whitespace-pre-wrap">
                          {result.result}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

