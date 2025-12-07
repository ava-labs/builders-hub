"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, AlertCircle, Plus, Lock } from "lucide-react";
import { AllocationEntry } from "./types";
import { isAddress } from "viem";

export interface TokenAllocationListProps {
  allocations: AllocationEntry[];
  onAllocationsChange: (newAllocations: AllocationEntry[]) => void;
}

export default function TokenAllocationList({
  allocations,
  onAllocationsChange,
}: TokenAllocationListProps) {
  const [newAddress, setNewAddress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isAddressInvalid = (
    address: string,
    currentId?: string,
    currentAllocations = allocations
  ): string | undefined => {
    if (!isAddress(address, { strict: false })) {
      return "Invalid Ethereum address format";
    }
    const occurrences = currentAllocations.filter(
      (allocation) =>
        allocation.address.toLowerCase() === address.toLowerCase() && allocation.id !== currentId
    ).length;
    if (occurrences > 0) {
      return "Duplicate address";
    }
    return undefined;
  };

  const handleAddAllocations = (newAllocations: Omit<AllocationEntry, "id">[]) => {
    const allocationsWithIds = newAllocations.map((allocation) => ({
      ...allocation,
      id: Math.random().toString(36).substr(2, 9),
    }));
    const updatedAllocations = [...allocations, ...allocationsWithIds];

    // Validate all allocations, including the new ones
    const validatedAllocations = updatedAllocations.map((allocation) => ({
      ...allocation,
      error: isAddressInvalid(allocation.address, allocation.id, updatedAllocations),
    }));

    onAllocationsChange(validatedAllocations);
  };

  const handleUpdateAllocation = (id: string, amount: number) => {
    const updatedAllocations = allocations.map((allocation) =>
      allocation.id === id ? { ...allocation, amount } : allocation
    );
    onAllocationsChange(updatedAllocations);
  };

  const handleDeleteAllocation = (id: string) => {
    const updatedAllocations = allocations.filter((allocation) => allocation.id !== id);

    // Re-validate all remaining allocations
    const validatedAllocations = updatedAllocations.map((allocation) => ({
      ...allocation,
      error: isAddressInvalid(allocation.address, allocation.id, updatedAllocations),
    }));

    onAllocationsChange(validatedAllocations);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setNewAddress(inputValue);

    if (isValidInput(inputValue)) {
      const newAddresses = inputValue.split(/[\s,]+/).filter((addr) => addr.trim() !== "");
      const newAllocations = newAddresses.map((address) => ({
        address,
        amount: 1_000_000,
        error: isAddressInvalid(address),
      }));
      handleAddAllocations(newAllocations);
      setNewAddress("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isValidInput(newAddress)) {
      const newAddresses = newAddress.split(/[\s,]+/).filter((addr) => addr.trim() !== "");
      const newAllocations = newAddresses.map((address) => ({
        address,
        amount: 10000000,
        error: isAddressInvalid(address),
      }));
      handleAddAllocations(newAllocations);
      setNewAddress("");
    }
  };

  const handleAmountChange = (id: string, amount: string) => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount >= 0) {
      handleUpdateAllocation(id, numericAmount);
    }
  };

  const isValidInput = (input: string): boolean => {
    const addresses = input.split(/[\s,]+/).filter((addr) => addr.trim() !== "");
    return (
      addresses.length > 0 && addresses.every((address) => isAddress(address, { strict: false }))
    );
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div>
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3">Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="w-1/6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center ${entry.error ? "text-red-500" : ""}`}
                      >
                        {entry.address}
                        {entry.error && <AlertCircle className="h-4 w-4 ml-2" />}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{entry.error || entry.requiredReason || "Valid address"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={entry.amount}
                    disabled={entry.requiredReason !== undefined}
                    onChange={(e) => handleAmountChange(entry.id, e.target.value)}
                    min="0"
                    step="0.000000000000000001"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  {entry.requiredReason && <Lock className="m-2 h-4 w-4 text-gray-500" />}
                  {!entry.requiredReason && (
                    <button
                      onClick={() => handleDeleteAllocation(entry.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                      aria-label="Delete allocation"
                    >
                      <Trash2 className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}>
                <div className="flex items-center">
                  <Plus className="h-4 w-4 text-gray-400 mr-2" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Add one or more addresses"
                    value={newAddress}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="w-full border-transparent bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 placeholder-gray-400"
                  />
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TooltipProvider>
      {allocations.length < 1 && (
        <p className="mt-2 text-sm text-red-500">
          Please add at least one address that holds some tokens.
        </p>
      )}
    </div>
  );
}
