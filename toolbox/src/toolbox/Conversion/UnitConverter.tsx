"use client";

import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";

export default function UnitConverter() {
    const { showBoundary } = useErrorBoundary();
    const [amount, setAmount] = useState<string>("1");
    const [selectedUnit, setSelectedUnit] = useState<string>("AVAX");
    const [results, setResults] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState<string | null>(null);

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
            title="Unit Converter"
            description="Convert between different AVAX denominations"
            logoColorTheme="red"
        >
            <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg space-y-2 border border-gray-100 dark:border-zinc-700">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                        AVAX is the native token used to pay gas on Avalanche's Primary Network. Each Avalanche L1 has only 1 token used to pay for
                        network fees on that specific Avalanche L1, this is defined by the Avalanche L1 deployer.
                    </p>
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                        Varying denominations such as Gwei and Wei are commonly used when interacting with cryptocurrency. Use this converter
                        to easily navigate between them.
                    </p>
                </div>

                <div className="space-y-4">
                    {units.map((unit) => (
                        <div key={unit.id} className="flex items-center">
                            <div className="w-28 flex-shrink-0 mr-3">
                                <span className={`text-sm font-medium ${unit.id === "AVAX" ? "text-blue-600 dark:text-blue-400" : ""}`}>
                                    {unit.label}
                                </span>
                            </div>
                            <div className="relative flex-grow flex">
                                <input
                                    type="number"
                                    value={unit.id === selectedUnit ? amount : results[unit.id] || ""}
                                    onChange={(e) => handleInputChange(e.target.value, unit.id)}
                                    placeholder="0"
                                    step={unit.exponent < 0 ? 0.000000001 : 1}
                                    className="w-full rounded-md px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm transition-colors duration-200 rounded-r-none border-r-0"
                                />
                                <button
                                    onClick={() => handleCopy(unit.id === selectedUnit ? amount : results[unit.id] || "", unit.id)}
                                    className="flex items-center justify-center px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-r-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
