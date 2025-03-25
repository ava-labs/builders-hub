"use client";

import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button, Input } from "../../ui";
import { cb58ToHex, hexToCB58 } from "../../../../../components/tools/common/utils/cb58";
 
export default function CipherConverter() {
    const { showBoundary } = useErrorBoundary();
    const [hexInput, setHexInput] = useState<string>("");
    const [cb58Output, setCb58Output] = useState<string>("");
    const [cb58Input, setCb58Input] = useState<string>("");
    const [hexOutput, setHexOutput] = useState<string>("");
    const [cb58ChecksumInput, setCb58ChecksumInput] = useState<string>("");
    const [hexChecksumOutput, setHexChecksumOutput] = useState<string>("");
    const [dirtyHexInput, setDirtyHexInput] = useState<string>("");
    const [cleanHexOutput, setCleanHexOutput] = useState<string>("");
    const [formattedHexInput, setFormattedHexInput] = useState<string>("");
    const [unformattedHexOutput, setUnformattedHexOutput] = useState<string>("");

    const convertHexToCb58 = () => {
        try {
            if (!hexInput) return;
            
            const cleanHex = hexInput.startsWith('0x') ? hexInput.slice(2) : hexInput;
            
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                throw new Error("Invalid hexadecimal input");
            }

            const cb58 = hexToCB58(cleanHex);

            setCb58Output(cb58);
        } catch (error) {
            showBoundary(error);
        }
    };

    const convertCb58ToHex = () => {
        try {
            if (!cb58Input) return;
            
            const hex = cb58ToHex(cb58Input);

            const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
            
            setHexOutput(cleanHex);
        } catch (error) {
            showBoundary(error);
        }
    };

    const convertCb58ToHexWithChecksum = () => {
        try {
            if (!cb58ChecksumInput) return;
            
            const hex = cb58ToHex(cb58ChecksumInput, false, true);
                        
            setHexChecksumOutput(`${hex}`);
        } catch (error) {
            showBoundary(error);
        }
    };

    const cleanHex = () => {
        try {
            if (!dirtyHexInput) return;
            
            const cleaned = dirtyHexInput.replace(/[^0-9a-fA-F]/g, '');
            
            setCleanHexOutput(`${cleaned}`);
        } catch (error) {
            showBoundary(error);
        }
    };

    const unformatHex = () => {
        try {
            if (!formattedHexInput) return;
            const cleanHex = formattedHexInput.startsWith('0x') ? formattedHexInput.slice(2) : formattedHexInput;
            const unformatted = cleanHex.replace(/\s+/g, '');
            setUnformattedHexOutput(unformatted);
        } catch (error) {
            showBoundary(error);
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Cipher Converter</h2>
            
            <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tools to convert between different encryption formats used in Avalanche.
                    Includes conversions between hexadecimal and CB58, cleaning of hexadecimal strings and more.
                </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-md font-semibold mb-4">Hex to cb58 encoded</h3>
                <div className="space-y-4">
                    <Input
                        label="Hex"
                        value={hexInput}
                        onChange={setHexInput}
                        placeholder="Enter a hexadecimal value"
                        type="text"
                    />
                    <Button
                        type="primary"
                        onClick={convertHexToCb58}
                        className="w-full"
                    >
                        Convert
                    </Button>
                    {cb58Output && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Result:</div>
                            <div className="text-lg font-medium break-all">{cb58Output}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-md font-semibold mb-4">cb58 encoded to Hex</h3>
                <div className="space-y-4">
                    <Input
                        label="CB58"
                        value={cb58Input}
                        onChange={setCb58Input}
                        placeholder="Enter a CB58 value"
                        type="text"
                    />
                    <Button
                        type="primary"
                        onClick={convertCb58ToHex}
                        className="w-full"
                    >
                        Convert
                    </Button>
                    {hexOutput && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Result:</div>
                            <div className="text-lg font-medium break-all">{hexOutput}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-md font-semibold mb-4">cb58 encoded to Hex with checksum</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        This tool converts a cb58 encoded string to a hexadecimal string with checksum, 
                        has 0x as a prefix and 4 bytes of checksum at the end. It will not work if you only copy and paste the 
                        hexadecimal string into the "Hex to cb58 encoded" tool.
                    </p>
                    <Input
                        label="CB58 with checksum"
                        value={cb58ChecksumInput}
                        onChange={setCb58ChecksumInput}
                        placeholder="Enter a CB58 value"
                        type="text"
                    />
                    <Button
                        type="primary"
                        onClick={convertCb58ToHexWithChecksum}
                        className="w-full"
                    >
                        Convert
                    </Button>
                    {hexChecksumOutput && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Result:</div>
                            <div className="text-lg font-medium break-all">{hexChecksumOutput}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-md font-semibold mb-4">Clean Hex String</h3>
                <div className="space-y-4">
                    <Input
                        label="Hex"
                        value={dirtyHexInput}
                        onChange={setDirtyHexInput}
                        placeholder="Enter a hexadecimal value with unwanted characters"
                        type="text"
                    />
                    <Button
                        type="primary"
                        onClick={cleanHex}
                        className="w-full"
                    >
                        Clean
                    </Button>
                    {cleanHexOutput && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Result:</div>
                            <div className="text-lg font-medium break-all">{cleanHexOutput}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-md font-semibold mb-4">Unformat Hex</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Removes white spaces.
                    </p>
                    <Input
                        label="Formatted Hex"
                        value={formattedHexInput}
                        onChange={setFormattedHexInput}
                        placeholder="Enter a formatted hexadecimal value"
                        type="text"
                    />
                    <Button
                        type="primary"
                        onClick={unformatHex}
                        className="w-full"
                    >
                        Unformat
                    </Button>
                    {unformattedHexOutput && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Result:</div>
                            <div className="text-lg font-medium break-all">{unformattedHexOutput}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}