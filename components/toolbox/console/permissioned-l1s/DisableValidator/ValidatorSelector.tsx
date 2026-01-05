"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, Users, Coins, Calendar, ChevronDown, Check, RefreshCw } from "lucide-react";
import { useAvalancheSDKChainkit } from "@/components/toolbox/stores/useAvalancheSDKChainkit";
import { ValidatorData } from "./DisableL1ValidatorContext";
import { formatAvaxBalance } from "@/components/toolbox/coreViem/utils/format";
import { Button } from "../../../components/Button";
import { Alert } from "../../../components/Alert";

interface ValidatorSelectorProps {
  subnetId: string;
  onSelect: (validator: ValidatorData | null) => void;
  selectedValidator: ValidatorData | null;
}

export default function ValidatorSelector({
  subnetId,
  onSelect,
  selectedValidator,
}: ValidatorSelectorProps) {
  const { listL1Validators } = useAvalancheSDKChainkit();
  const [validators, setValidators] = useState<ValidatorData[]>([]);
  const [filteredValidators, setFilteredValidators] = useState<ValidatorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchValidators = useCallback(async () => {
    if (!subnetId) return;

    setIsLoading(true);
    setError(null);
    onSelect(null);

    try {
      // Use the avalanche-sdk-typescript via the hook
      const result = await listL1Validators({
        subnetId,
        includeInactiveL1Validators: false,
      });

      // Extract validators from the response
      const allValidators: ValidatorData[] = [];

      // Handle the paginated response structure from avalanche-sdk
      if (result && 'validators' in result) {
        allValidators.push(...(result.validators as unknown as ValidatorData[]));
      }

      // Filter to only show active validators (weight > 0)
      const activeValidators = allValidators.filter(v => v.weight > 0);
      setValidators(activeValidators);
      setFilteredValidators(activeValidators);
      setIsExpanded(true);
    } catch (err) {
      console.error("Error fetching validators:", err);
      setError("Failed to fetch validators");
    } finally {
      setIsLoading(false);
    }
  }, [subnetId, listL1Validators, onSelect]);

  // Filter validators based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredValidators(validators);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = validators.filter(
      (v) =>
        v.nodeId.toLowerCase().includes(term) ||
        v.validationId.toLowerCase().includes(term)
    );
    setFilteredValidators(filtered);
  }, [searchTerm, validators]);

  // Fetch validators when subnet changes
  useEffect(() => {
    if (subnetId) {
      fetchValidators();
    } else {
      setValidators([]);
      setFilteredValidators([]);
    }
  }, [subnetId]);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleSelect = (validator: ValidatorData) => {
    onSelect(validator);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Select Validator to Disable
        </label>
        <button
          onClick={fetchValidators}
          disabled={isLoading || !subnetId}
          className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Selected Validator Display */}
      {selectedValidator && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="font-mono text-sm">{selectedValidator.nodeId}</span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Balance: {formatAvaxBalance(parseFloat(selectedValidator.remainingBalance))}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>
        </button>
      )}

      {/* Validator List */}
      {isExpanded && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Node ID or Validation ID..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              <span className="ml-2 text-sm text-zinc-500">Loading validators...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          {/* Validator List */}
          {!isLoading && !error && filteredValidators.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {filteredValidators.map((validator) => (
                <button
                  key={validator.validationId}
                  onClick={() => handleSelect(validator)}
                  className={`w-full text-left p-3 border-b border-zinc-100 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
                    selectedValidator?.validationId === validator.validationId
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-mono text-sm truncate" title={validator.nodeId}>
                        {validator.nodeId}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {formatAvaxBalance(parseFloat(validator.remainingBalance))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Weight: {validator.weight.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatTimestamp(validator.creationTimestamp)}
                        </span>
                      </div>
                      {validator.deactivationOwner && (
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">
                          Deactivation: {validator.deactivationOwner.threshold}/{validator.deactivationOwner.addresses.length} owners
                        </div>
                      )}
                    </div>
                    {selectedValidator?.validationId === validator.validationId && (
                      <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredValidators.length === 0 && validators.length > 0 && (
            <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No validators match your search.
            </div>
          )}

          {!isLoading && !error && validators.length === 0 && (
            <div className="py-6 text-center space-y-2">
              <Users className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No active validators found for this subnet.
              </p>
              <Button variant="secondary" onClick={fetchValidators} className="text-xs">
                Try Again
              </Button>
            </div>
          )}

          {/* Close/Cancel */}
          {selectedValidator && (
            <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <Button
                variant="secondary"
                onClick={() => setIsExpanded(false)}
                className="w-full text-xs"
              >
                Keep Current Selection
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Prompt to fetch validators */}
      {!isLoading && validators.length === 0 && !error && !isExpanded && !selectedValidator && (
        <Button
          variant="secondary"
          onClick={fetchValidators}
          disabled={!subnetId}
          className="w-full"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </span>
          ) : (
            "Load Validators"
          )}
        </Button>
      )}
    </div>
  );
}
