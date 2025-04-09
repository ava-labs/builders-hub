"use client";

import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";

export default function UnitConverter() {
    const { showBoundary } = useErrorBoundary();
    const [amount, setAmount] = useState<string>("1.00");
    const [selectedUnit, setSelectedUnit] = useState<string>("AVAX");
    const [results, setResults] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState<string | null>(null);

    const units = [
        { id: "wei", label: "Wei (C-Chain) 10⁻¹⁸", factor: BigInt("1"), exponent: -18 },
        { id: "nAVAX", label: "nAVAX (P-Chain) 10⁻⁹", factor: BigInt("1000000000"), exponent: -9 },
        { id: "AVAX", label: "AVAX", factor: BigInt("1000000000000000000"), exponent: 0 }
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
        setAmount("1.00");
        setSelectedUnit("AVAX");
    };

    const handleCopy = (value: string, unitId: string) => {
        navigator.clipboard.writeText(value);
        setCopied(unitId);
        setTimeout(() => setCopied(null), 2000);
    };

    useEffect(() => {
        setResults(convertUnits(amount, selectedUnit));
    }, [amount, selectedUnit]);

    return (
        <Container 
            title="AVAX Unit Converter"
            description="Convert between AVAX, P-Chain nAVAX, and C-Chain wei"
            logoColorTheme="red"
        >
            <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg space-y-2 border border-gray-100 dark:border-zinc-700">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                        Avalanche has different chains that use different base units for AVAX:
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-zinc-300 list-disc pl-5 space-y-1">
                        <li><span className="text-blue-600 dark:text-blue-400 font-medium"><strong>C-Chain</strong></span>: Uses wei (10⁻¹⁸) as the base unit, similar to Ethereum</li>
                        <li><span className="text-red-600 dark:text-red-400 font-medium"><strong>P-Chain</strong></span>: Uses nAVAX (10⁻⁹) as the base unit</li>
                    </ul>
                    <p className="text-sm text-gray-700 dark:text-zinc-300 mt-2">
                        This converter helps you translate between these different denominations when working across chains.
                    </p>
                </div>

                <div className="space-y-4">
                    {units.map((unit) => (
                        <div key={unit.id} className="flex items-center">
                            <div className="w-44 flex-shrink-0 mr-3">
                                <span className={`text-sm font-medium ${
                                    unit.id === "nAVAX" ? "text-red-600 dark:text-red-400" : 
                                    unit.id === "wei" ? "text-blue-600 dark:text-blue-400" : ""
                                }`}>
                                    {unit.label}
                                </span>
                            </div>
                            <div className="relative flex-grow flex">
                                <input
                                    type="number"
                                    value={unit.id === selectedUnit ? amount : results[unit.id] || ""}
                                    onChange={(e) => handleInputChange(e.target.value, unit.id)}
                                    placeholder="0"
                                    step={unit.exponent < 0 ? 0.000000001 : 0.01}
                                    className={`w-full rounded-md px-3 py-2.5 bg-white dark:bg-zinc-900 border 
                                        ${unit.id === "nAVAX" ? "border-red-300 dark:border-red-700" : 
                                        unit.id === "wei" ? "border-blue-300 dark:border-blue-700" :
                                        "border-zinc-300 dark:border-zinc-700"} 
                                        text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 
                                        focus:ring-primary/30 focus:border-primary shadow-sm transition-colors 
                                        duration-200 rounded-r-none border-r-0`}
                                />
                                <button
                                    onClick={() => handleCopy(unit.id === selectedUnit ? amount : results[unit.id] || "", unit.id)}
                                    className={`flex items-center justify-center px-2 bg-white dark:bg-zinc-900 border 
                                        ${unit.id === "nAVAX" ? "border-red-300 dark:border-red-700" : 
                                        unit.id === "wei" ? "border-blue-300 dark:border-blue-700" :
                                        "border-zinc-300 dark:border-zinc-700"} 
                                        rounded-r-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors`}
                                >
                                    {copied === unit.id ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4 text-zinc-500" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <Button
                    onClick={handleReset}
                    variant="secondary"
                    className="mt-4"
                >
                    Reset
                </Button>
            </div>
        </Container>
    );
}
