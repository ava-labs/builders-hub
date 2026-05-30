/**
 * Script to generate event and function signature maps from ABI files
 * This runs at build time to create lookup tables for decoding event logs and transaction input
 */

import fs from 'fs';
import path from 'path';
import { keccak256 } from 'viem';

interface AbiInput {
  indexed?: boolean;
  name: string;
  type: string;
  components?: AbiInput[];
}

interface AbiEvent {
  anonymous?: boolean;
  inputs: AbiInput[];
  name: string;
  type: 'event';
}

interface AbiFunction {
  inputs: AbiInput[];
  name: string;
  type: 'function';
  stateMutability?: string;
  outputs?: AbiInput[];
}

interface SignatureInput {
  name: string;
  type: string;
  indexed?: boolean;
  components?: SignatureInput[];
}

interface EventSignature {
  name: string;
  signature: string;
  topic: string;
  indexedCount: number;
  inputs: SignatureInput[];
}

interface FunctionSignature {
  name: string;
  signature: string;
  selector: string;
  inputs: SignatureInput[];
}

// Map from topic -> array of variants (different indexed param configurations)
type EventSignatureMap = Record<string, EventSignature[]>;
// Map from selector -> function signature
type FunctionSignatureMap = Record<string, FunctionSignature>;

const ABI_DIR = path.join(process.cwd(), 'abi');
const OUTPUT_FILE = path.join(process.cwd(), 'abi/event-signatures.generated.ts');

/**
 * Recursively expand tuple types into their canonical form for signature computation.
 * Solidity signatures use the expanded form: (type1,type2,...) instead of "tuple"
 */
function expandType(input: AbiInput): string {
  if (input.type === 'tuple' && input.components) {
    const innerTypes = input.components.map(expandType).join(',');
    return `(${innerTypes})`;
  }
  if (input.type === 'tuple[]' && input.components) {
    const innerTypes = input.components.map(expandType).join(',');
    return `(${innerTypes})[]`;
  }
  return input.type;
}

function getEventSignature(event: AbiEvent): string {
  const params = event.inputs.map(expandType).join(',');
  return `${event.name}(${params})`;
}

function getFunctionSignature(func: AbiFunction): string {
  const params = func.inputs.map(expandType).join(',');
  return `${func.name}(${params})`;
}

function getHash(signature: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(signature);
  return keccak256(bytes);
}

function getFunctionSelector(signature: string): string {
  // Function selector is the first 4 bytes (8 hex chars + 0x prefix = 10 chars)
  return getHash(signature).slice(0, 10);
}

function getIndexedCount(event: AbiEvent): number {
  return event.inputs.filter(input => input.indexed).length;
}

/**
 * Convert ABI input to our SignatureInput format, preserving components for tuples
 */
function convertInput(input: AbiInput, isComponent: boolean = false): SignatureInput {
  const result: SignatureInput = {
    name: input.name,
    type: input.type,
  };
  
  // Only include indexed for event parameters (not components, not function params)
  if (!isComponent && input.indexed !== undefined) {
    result.indexed = input.indexed;
  }
  
  if (input.components) {
    result.components = input.components.map(c => convertInput(c, true));
  }
  
  return result;
}

async function generateSignatures(): Promise<void> {
  console.log('🔍 Scanning ABI directory:', ABI_DIR);
  
  const eventMap: EventSignatureMap = {};
  const functionMap: FunctionSignatureMap = {};
  
  // Read all JSON files in the abi directory
  const files = fs.readdirSync(ABI_DIR).filter(file => file.endsWith('.json'));
  
  console.log(`📁 Found ${files.length} ABI files`);
  
  for (const file of files) {
    const filePath = path.join(ABI_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const abi = JSON.parse(content) as (AbiEvent | AbiFunction)[];
      const events = abi.filter((item): item is AbiEvent => item.type === 'event');
      const functions = abi.filter((item): item is AbiFunction => item.type === 'function');
      
      console.log(`  📄 ${file}: ${events.length} events, ${functions.length} functions`);
      
      // Process events
      for (const event of events) {
        const signature = getEventSignature(event);
        const topic = getHash(signature).toLowerCase();
        const indexedCount = getIndexedCount(event);
        
        const eventSig: EventSignature = {
          name: event.name,
          signature,
          topic,
          indexedCount,
          inputs: event.inputs.map(input => convertInput(input, false)),
        };
        
        // Initialize array if needed
        if (!eventMap[topic]) {
          eventMap[topic] = [];
        }
        
        // Check if we already have a variant with the same indexed count
        const existingVariant = eventMap[topic].find(v => v.indexedCount === indexedCount);
        if (!existingVariant) {
          eventMap[topic].push(eventSig);
          console.log(`    ✓ Event ${event.name}: ${signature} → ${topic.slice(0, 18)}...`);
        }
      }
      
      // Process functions
      for (const func of functions) {
        const signature = getFunctionSignature(func);
        const selector = getFunctionSelector(signature).toLowerCase();
        
        // Skip if we already have this selector (first one wins)
        if (functionMap[selector]) {
          continue;
        }
        
        const funcSig: FunctionSignature = {
          name: func.name,
          signature,
          selector,
          inputs: func.inputs.map(input => convertInput(input, false)),
        };
        
        functionMap[selector] = funcSig;
        console.log(`    ✓ Function ${func.name}: ${signature} → ${selector}`);
      }
    } catch (error) {
      console.error(`  ❌ Error parsing ${file}:`, error);
    }
  }
  
  const totalEventSignatures = Object.keys(eventMap).length;
  const totalEventVariants = Object.values(eventMap).reduce((sum, variants) => sum + variants.length, 0);
  const eventCollisions = Object.values(eventMap).filter(v => v.length > 1).length;
  const totalFunctionSignatures = Object.keys(functionMap).length;
  
  console.log(`\n✅ Generated ${totalEventSignatures} unique event signatures (${totalEventVariants} variants, ${eventCollisions} with collisions)`);
  console.log(`✅ Generated ${totalFunctionSignatures} unique function signatures`);
  
  // Generate the TypeScript file
  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated by: scripts/generate-event-signatures.mts
 * 
 * This file contains event and function signature mappings for decoding EVM logs and transaction input
 */

export interface SignatureInput {
  name: string;
  type: string;
  indexed?: boolean;
  components?: SignatureInput[];
}

export interface EventSignature {
  name: string;
  signature: string;
  topic: string;
  indexedCount: number;
  inputs: SignatureInput[];
}

export interface FunctionSignature {
  name: string;
  signature: string;
  selector: string;
  inputs: SignatureInput[];
}

/**
 * Map from topic hash to array of event signature variants.
 * Multiple variants exist when different contracts have the same event signature
 * but different indexed parameters (e.g., ERC20 vs ERC721 Transfer).
 */
export const EVENT_SIGNATURES: Record<string, EventSignature[]> = ${JSON.stringify(eventMap, null, 2)};

/**
 * Map from function selector to function signature.
 */
export const FUNCTION_SIGNATURES: Record<string, FunctionSignature> = ${JSON.stringify(functionMap, null, 2)};

/**
 * Get all event signature variants by topic hash
 */
export function getEventVariantsByTopic(topic: string): EventSignature[] | undefined {
  return EVENT_SIGNATURES[topic.toLowerCase()];
}

/**
 * Get the best matching event signature based on log structure.
 * Uses the number of indexed topics to determine the correct variant.
 */
export function getEventByTopic(topic: string, topicsCount: number): EventSignature | undefined {
  const variants = EVENT_SIGNATURES[topic.toLowerCase()];
  if (!variants || variants.length === 0) return undefined;
  
  // topicsCount includes topic[0] (event signature), so indexed params = topicsCount - 1
  const indexedParamsCount = topicsCount - 1;
  
  // Find variant matching the indexed count
  const exactMatch = variants.find(v => v.indexedCount === indexedParamsCount);
  if (exactMatch) return exactMatch;
  
  // Fallback to first variant if no exact match
  return variants[0];
}

/**
 * Get function signature by selector (first 4 bytes of input data)
 */
export function getFunctionBySelector(selector: string): FunctionSignature | undefined {
  return FUNCTION_SIGNATURES[selector.toLowerCase()];
}

/**
 * Format a decoded value for display based on its type
 */
function formatValue(value: string, type: string): string {
  if (type === 'address') {
    return '0x' + value.slice(-40);
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    try {
      return BigInt(value.startsWith('0x') ? value : '0x' + value).toString();
    } catch {
      return value;
    }
  }
  if (type === 'bool') {
    try {
      return BigInt(value.startsWith('0x') ? value : '0x' + value) !== BigInt(0) ? 'true' : 'false';
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Check if a type is dynamic (variable length)
 */
function isDynamicType(type: string, components?: SignatureInput[]): boolean {
  if (type === 'bytes' || type === 'string' || type.endsWith('[]')) {
    return true;
  }
  if (type === 'tuple' && components) {
    return components.some(c => isDynamicType(c.type, c.components));
  }
  return false;
}

/**
 * Decode tuple data from the data field
 * Handles both static and dynamic tuple encoding properly
 */
function decodeTupleData(
  data: string,
  offset: number,
  components: SignatureInput[]
): { values: Array<{ name: string; type: string; value: string }>; bytesConsumed: number } {
  const values: Array<{ name: string; type: string; value: string }> = [];
  
  // Check if this tuple contains any dynamic types
  const hasDynamicTypes = components.some(c => isDynamicType(c.type, c.components));
  
  if (!hasDynamicTypes) {
    // Simple case: all static types, elements are contiguous
    let currentOffset = offset;
    for (const component of components) {
      if (component.type === 'tuple' && component.components) {
        const result = decodeTupleData(data, currentOffset, component.components);
        values.push({
          name: component.name,
          type: component.type,
          value: JSON.stringify(result.values),
        });
        currentOffset += result.bytesConsumed;
      } else if (data.length >= currentOffset + 64) {
        const chunk = data.slice(currentOffset, currentOffset + 64);
        values.push({
          name: component.name,
          type: component.type,
          value: formatValue('0x' + chunk, component.type),
        });
        currentOffset += 64;
      }
    }
    return { values, bytesConsumed: currentOffset - offset };
  }
  
  // Complex case: tuple has dynamic types
  // Head contains: static values inline, dynamic values as offsets (relative to tuple start)
  // Tail contains: actual dynamic data
  
  const headSize = components.length * 64; // 32 bytes (64 hex chars) per slot in head
  let tailEnd = offset + headSize; // Track the end of tail for bytesConsumed
  let headOffset = offset;
  
  for (const component of components) {
    if (data.length < headOffset + 64) break;
    
    const chunk = data.slice(headOffset, headOffset + 64);
    
    if (component.type === 'tuple' && component.components) {
      // Nested tuple with dynamic types - follow offset
      if (isDynamicType(component.type, component.components)) {
        const tupleOffset = parseInt(chunk, 16) * 2; // Convert bytes to hex chars
        const tupleDataStart = offset + tupleOffset;
        const result = decodeTupleData(data, tupleDataStart, component.components);
        values.push({
          name: component.name,
          type: component.type,
          value: JSON.stringify(result.values),
        });
        tailEnd = Math.max(tailEnd, tupleDataStart + result.bytesConsumed);
      } else {
        // Static nested tuple - inline
        const result = decodeTupleData(data, headOffset, component.components);
        values.push({
          name: component.name,
          type: component.type,
          value: JSON.stringify(result.values),
        });
        // For static nested tuples, they take their actual size, not just one slot
        // But in ABI encoding, even nested tuples take slots in the head
      }
    } else if (component.type === 'bytes' || component.type === 'string') {
      // Dynamic type - chunk contains offset to actual data
      const dataOffset = parseInt(chunk, 16) * 2; // Convert bytes to hex chars
      const dataStart = offset + dataOffset;
      
      if (data.length >= dataStart + 64) {
        // Read length
        const lengthHex = data.slice(dataStart, dataStart + 64);
        const length = parseInt(lengthHex, 16);
        const dataEnd = dataStart + 64 + length * 2;
        
        if (component.type === 'string' && data.length >= dataEnd) {
          // Decode string
          const strHex = data.slice(dataStart + 64, dataEnd);
          try {
            const strBytes = strHex.match(/.{1,2}/g) || [];
            const str = strBytes.map(b => String.fromCharCode(parseInt(b, 16))).join('').replace(/\\0/g, '');
            values.push({ name: component.name, type: component.type, value: str });
          } catch {
            values.push({ name: component.name, type: component.type, value: '[bytes]' });
          }
        } else {
          // Just show hex for bytes
          const bytesHex = data.slice(dataStart + 64, Math.min(dataEnd, dataStart + 64 + 128));
          values.push({
            name: component.name,
            type: component.type,
            value: length > 64 ? \`0x\${bytesHex}... (\${length} bytes)\` : \`0x\${bytesHex}\`,
          });
        }
        tailEnd = Math.max(tailEnd, dataEnd);
      } else {
        values.push({ name: component.name, type: component.type, value: '[dynamic]' });
      }
    } else if (component.type.endsWith('[]')) {
      // Array - chunk contains offset
      const arrayOffset = parseInt(chunk, 16) * 2;
      const arrayStart = offset + arrayOffset;
      
      if (data.length >= arrayStart + 64) {
        const lengthHex = data.slice(arrayStart, arrayStart + 64);
        const length = parseInt(lengthHex, 16);
        values.push({
          name: component.name,
          type: component.type,
          value: \`[array of \${length}]\`,
        });
        // Estimate array end (rough - assumes 32 bytes per element)
        tailEnd = Math.max(tailEnd, arrayStart + 64 + length * 64);
      } else {
        values.push({ name: component.name, type: component.type, value: '[array]' });
      }
    } else {
      // Static type - value is inline in head
      values.push({
        name: component.name,
        type: component.type,
        value: formatValue('0x' + chunk, component.type),
      });
    }
    
    headOffset += 64;
  }
  
  return { values, bytesConsumed: tailEnd - offset };
}

/**
 * Decode event log using the signature map
 */
export function decodeEventLog(log: { topics: string[]; data: string }): {
  name: string;
  signature: string;
  params: Array<{ name: string; type: string; value: string; indexed: boolean; components?: Array<{ name: string; type: string; value: string }> }>;
} | null {
  if (!log.topics || log.topics.length === 0) return null;
  
  const eventSig = getEventByTopic(log.topics[0], log.topics.length);
  if (!eventSig) return null;
  
  const params: Array<{ name: string; type: string; value: string; indexed: boolean; components?: Array<{ name: string; type: string; value: string }> }> = [];
  
  let topicIndex = 1;
  let dataOffset = 0;
  const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
  
  for (const input of eventSig.inputs) {
    let value = '';
    let decodedComponents: Array<{ name: string; type: string; value: string }> | undefined;
    
    if (input.indexed) {
      // Indexed parameters are in topics
      if (topicIndex < log.topics.length) {
        const topic = log.topics[topicIndex];
        value = formatValue(topic, input.type);
        topicIndex++;
      }
    } else {
      // Non-indexed parameters are in data
      if (input.type === 'tuple' && input.components) {
        // Decode tuple
        const result = decodeTupleData(data, dataOffset, input.components);
        decodedComponents = result.values;
        value = \`(\${result.values.map(v => v.value).join(', ')})\`;
        dataOffset += result.bytesConsumed;
      } else if (data.length >= dataOffset + 64) {
        const chunk = data.slice(dataOffset, dataOffset + 64);
        value = formatValue('0x' + chunk, input.type);
        dataOffset += 64;
      }
    }
    
    const param: { name: string; type: string; value: string; indexed: boolean; components?: Array<{ name: string; type: string; value: string }> } = {
      name: input.name,
      type: input.type,
      value,
      indexed: input.indexed || false,
    };
    
    if (decodedComponents) {
      param.components = decodedComponents;
    }
    
    params.push(param);
  }
  
  return {
    name: eventSig.name,
    signature: eventSig.signature,
    params,
  };
}

/**
 * Decode transaction input data using the function signature map
 */
export function decodeFunctionInput(input: string): {
  name: string;
  signature: string;
  selector: string;
  params: Array<{ name: string; type: string; value: string; components?: Array<{ name: string; type: string; value: string }> }>;
} | null {
  if (!input || input === '0x' || input.length < 10) return null;
  
  const selector = input.slice(0, 10).toLowerCase();
  const funcSig = getFunctionBySelector(selector);
  if (!funcSig) return null;
  
  const params: Array<{ name: string; type: string; value: string; components?: Array<{ name: string; type: string; value: string }> }> = [];
  
  let dataOffset = 0;
  const data = input.slice(10); // Remove selector
  
  for (const inputDef of funcSig.inputs) {
    let value = '';
    let decodedComponents: Array<{ name: string; type: string; value: string }> | undefined;
    
    if (inputDef.type === 'tuple' && inputDef.components) {
      // Decode tuple
      const result = decodeTupleData(data, dataOffset, inputDef.components);
      decodedComponents = result.values;
      value = \`(\${result.values.map(v => v.value).join(', ')})\`;
      dataOffset += result.bytesConsumed;
    } else if (inputDef.type.endsWith('[]')) {
      // Array type - read offset pointer for now
      if (data.length >= dataOffset + 64) {
        value = '[array]';
        dataOffset += 64;
      }
    } else if (inputDef.type === 'bytes' || inputDef.type === 'string') {
      // Dynamic type - read offset pointer
      if (data.length >= dataOffset + 64) {
        value = '[dynamic]';
        dataOffset += 64;
      }
    } else if (data.length >= dataOffset + 64) {
      const chunk = data.slice(dataOffset, dataOffset + 64);
      value = formatValue('0x' + chunk, inputDef.type);
      dataOffset += 64;
    }
    
    const param: { name: string; type: string; value: string; components?: Array<{ name: string; type: string; value: string }> } = {
      name: inputDef.name,
      type: inputDef.type,
      value,
    };
    
    if (decodedComponents) {
      param.components = decodedComponents;
    }
    
    params.push(param);
  }
  
  return {
    name: funcSig.name,
    signature: funcSig.signature,
    selector,
    params,
  };
}
`;
  
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`📝 Written to: ${OUTPUT_FILE}`);
}

generateSignatures().catch(console.error);
