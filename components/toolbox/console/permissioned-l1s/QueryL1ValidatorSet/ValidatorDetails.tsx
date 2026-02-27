"use client";

import { Calendar, Clock, Users, Coins, Copy, Check } from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";
import { formatAvaxBalance } from "@/components/toolbox/coreViem/utils/format";
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter";
import { ValidatorResponse, formatTimestamp, formatStake } from "./types";

interface ValidatorDetailsProps {
  validator: ValidatorResponse;
  onClose: () => void;
  copyToClipboard: (text: string) => void;
  copiedId: string | null;
}

function CopyableField({
  label,
  value,
  copyToClipboard,
  copiedId,
}: {
  label: string;
  value: string;
  copyToClipboard: (text: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <div className="flex items-center">
        <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200" title={value}>
          {value}
        </p>
        <button
          onClick={() => copyToClipboard(value)}
          className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
          title={`Copy ${label}`}
        >
          {copiedId === value ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
          )}
        </button>
      </div>
    </div>
  );
}

function OwnerSection({
  title,
  owner,
  copyToClipboard,
  copiedId,
}: {
  title: string;
  owner: { addresses: string[]; threshold: number };
  copyToClipboard: (text: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 mt-4 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
          <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
          {title}
        </h4>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
          Threshold: {owner.threshold}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Addresses</p>
          <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300">
            {owner.addresses.length}
          </span>
        </div>
        <div className="max-h-40 overflow-y-auto border border-zinc-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/80 divide-y divide-zinc-200/80 dark:divide-zinc-800">
          {owner.addresses.map((address, index) => (
            <div key={index} className="flex items-center justify-between p-2.5">
              <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200 pr-2">
                {address}
              </p>
              <button
                onClick={() => copyToClipboard(address)}
                className="p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                title="Copy Address"
              >
                {copiedId === address ? (
                  <Check size={12} className="text-green-500" />
                ) : (
                  <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ValidatorDetails({
  validator,
  onClose,
  copyToClipboard,
  copiedId,
}: ValidatorDetailsProps) {
  const hexValidationId = (() => {
    try {
      return "0x" + cb58ToHex(validator.validationId);
    } catch {
      return null;
    }
  })();

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 mt-4 transition-opacity duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">Validator Details</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Detailed information about the selected validator
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Node Information */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 transition-colors">
          <h4 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
            <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
            Node Information
          </h4>
          <div className="space-y-3">
            <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID</p>
              <div className="flex items-center">
                <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200" title={validator.validationId}>
                  {validator.validationId}
                </p>
                <button
                  onClick={() => copyToClipboard(validator.validationId)}
                  className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Copy Validation ID"
                >
                  {copiedId === validator.validationId ? (
                    <Check size={12} className="text-green-500" />
                  ) : (
                    <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                  )}
                </button>
              </div>

              {hexValidationId && (
                <div className="mt-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID (Hex)</p>
                  <div className="flex items-center">
                    <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200" title={hexValidationId}>
                      {hexValidationId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(hexValidationId)}
                      className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                      title="Copy Hex ID"
                    >
                      {copiedId === hexValidationId ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {!hexValidationId && (
                <div className="mt-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID (Hex)</p>
                  <p className="font-mono text-xs text-red-500">Unable to convert to hex</p>
                </div>
              )}
            </div>

            <CopyableField label="Node ID" value={validator.nodeId} copyToClipboard={copyToClipboard} copiedId={copiedId} />
            <CopyableField label="Subnet ID" value={validator.subnetId} copyToClipboard={copyToClipboard} copiedId={copiedId} />
          </div>
        </div>

        {/* Staking and Time Information */}
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 transition-colors">
            <h4 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
              <Coins className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
              Staking Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Amount Staked</p>
                <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatAvaxBalance(parseFloat(validator.remainingBalance))}
                </p>
              </div>
              <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Weight</p>
                <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatStake(validator.weight.toString())}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 transition-colors">
            <h4 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
              <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
              Time Information
            </h4>
            <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Creation Time</p>
              <div className="flex items-center">
                <Calendar size={14} className="text-zinc-500 dark:text-zinc-400 mr-1.5" />
                <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                  {formatTimestamp(validator.creationTimestamp)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {validator.remainingBalanceOwner && (
        <OwnerSection
          title="Remaining Balance Owner"
          owner={validator.remainingBalanceOwner}
          copyToClipboard={copyToClipboard}
          copiedId={copiedId}
        />
      )}

      {validator.deactivationOwner && (
        <OwnerSection
          title="Deactivation Owner"
          owner={validator.deactivationOwner}
          copyToClipboard={copyToClipboard}
          copiedId={copiedId}
        />
      )}
    </div>
  );
}
