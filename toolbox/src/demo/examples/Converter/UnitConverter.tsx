"use client";

import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button, Input } from "../../ui";

export default function UnitConverter() {
    const { showBoundary } = useErrorBoundary();
    const [amount, setAmount] = useState<string>("1");
    const [selectedUnit, setSelectedUnit] = useState<string>("AVAX");
    const [results, setResults] = useState<Record<string, string>>({});

    const units = [
        { id: "wei", label: "Wei 10⁻¹⁸", factor: BigInt("1"), exponent: -18 },
        { id: "kwei", label: "KWei", factor: BigInt("1000"), exponent: -15 },
        { id: "mwei", label: "MWei", factor: BigInt("1000000"), exponent: -12 },
        { id: "nAVAX", label: "nAVAX (10⁻⁹)", factor: BigInt("1000000000"), exponent: -9 },
        { id: "uAVAX", label: "µAVAX", factor: BigInt("1000000000000"), exponent: -6 },
        { id: "mAVAX", label: "mAVAX", factor: BigInt("1000000000000000"), exponent: -3 },
        { id: "AVAX", label: "AVAX", factor: BigInt("1000000000000000000"), exponent: 0 },
        { id: "kAVAX", label: "kAVAX", factor: BigInt("1000000000000000000000"), exponent: 3 },
        { id: "MAVAX", label: "MAVAX", factor: BigInt("1000000000000000000000000"), exponent: 6 },
        { id: "GAVAX", label: "GAVAX", factor: BigInt("1000000000000000000000000000"), exponent: 9 },
        { id: "TAVAX", label: "TAVAX", factor: BigInt("1000000000000000000000000000000"), exponent: 12 }
    ];

    const convertUnits = (inputAmount: string, fromUnit: string) => {
        try {
            if (!inputAmount || isNaN(Number(inputAmount))) {
                return {};
            }

            const sourceUnit = units.find(u => u.id === fromUnit)!;

            let baseAmount: bigint;
            try {
                if (inputAmount.includes('.')) {
                    const [whole, decimal] = inputAmount.split('.');
                    const wholeValue = whole === '' ? BigInt(0) : BigInt(whole);
                    const wholeInWei = wholeValue * sourceUnit.factor;
                    
                    const decimalPlaces = decimal.length;
                    const decimalValue = BigInt(decimal);
                    const decimalFactor = sourceUnit.factor / BigInt(10 ** decimalPlaces);
                    const decimalInWei = decimalValue * decimalFactor;
                    
                    baseAmount = wholeInWei + decimalInWei;
                } else {
                    baseAmount = BigInt(inputAmount) * sourceUnit.factor;
                }
            } catch (error) {
                throw new Error("Error converting: please verify that the number is valid");
            }

            const results: Record<string, string> = {};
            units.forEach(unit => {
                if (baseAmount === BigInt(0)) {
                    results[unit.id] = "0";
                    return;
                }
                
                const quotient = baseAmount / unit.factor;
                const remainder = baseAmount % unit.factor;
                
                if (remainder === BigInt(0)) {
                    results[unit.id] = quotient.toString();
                } else {
                    const decimalPart = remainder.toString().padStart(unit.factor.toString().length - 1, '0');
                    const trimmedDecimal = decimalPart.replace(/0+$/, '');
                    results[unit.id] = `${quotient}.${trimmedDecimal}`;
                }
            });
            
            return results;
        } catch (error) {
            showBoundary(error);
            return {};
        }
    };

    const handleInputChange = (value: string, unit: string) => {
        setAmount(value);
        setSelectedUnit(unit);
    };

    const handleReset = () => {
        setAmount("1");
        setSelectedUnit("AVAX");
    };

    useEffect(() => {
        setResults(convertUnits(amount, selectedUnit));
    }, [amount, selectedUnit]);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Unit Converter</h2>
            
            <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    AVAX is the native token used to pay gas on Avalanche's Primary Network. Each Avalanche L1 has only 1 token used to pay for 
                    network fees on that specific Avalanche L1, this is defined by the Avalanche L1 deployer. Network Tokens are used to pay for gas 
                    on Avalanche L1s, and can be native to that Avalanche L1 or bridged from another chain.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Varying denominations such as Gwei and Wei are commonly used when interacting with cryptocurrency. Use Avalanche's Unit Converter
                    to easily navigate between them.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-4">
                    {units.map((unit) => (
                        <div key={unit.id} className="flex items-center space-x-4">
                            <div className="w-32 flex-shrink-0">
                                <span className={`text-sm font-medium ${unit.id === "AVAX" ? "text-blue-600 dark:text-blue-400" : ""}`}>
                                    {unit.label}
                                </span>
                            </div>
                            <Input
                                value={unit.id === selectedUnit ? amount : results[unit.id] || ""}
                                onChange={(value) => {
                                    handleInputChange(value, unit.id);
                                }}
                                className="flex-grow"
                                placeholder="0"
                                type="number"
                                step={unit.exponent < 0 ? 0.000000001 : 1} 
                            />
                            <Button
                                type="secondary"
                                onClick={() => {
                                    navigator.clipboard.writeText(unit.id === selectedUnit ? amount : results[unit.id] || "");
                                }}
                                className="flex-shrink-0"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </Button>
                        </div>
                    ))}
                </div>

                <Button
                    type="secondary"
                    onClick={handleReset}
                    className="w-full"
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}