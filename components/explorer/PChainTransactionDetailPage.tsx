"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Hash, 
  ArrowRightLeft, 
  Check, 
  X, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck,
  ShieldX,
  ShieldPlus,
  Users,
  Network,
  Link2,
  ArrowUpRight,
  ArrowDownLeft,
  Layers,
  Coins,
  FileText,
  FileCode,
  Download,
  Copy,
  UserPlus,
  UserMinus,
  Scale,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DetailRow, CopyButton } from "@/components/explorer/DetailRow";
import type { DecodedTransaction, DecodedInput, DecodedOutput } from "@/lib/pchain/txDecoder";

// ============================================================================
// Types
// ============================================================================

interface TransactionDetailResponse {
  txId: string;
  status: string;
  statusReason?: string;
  type: string;
  typeDescription: string;
  typeColor: string;
  summary: string;
  decoded: DecodedTransaction;
}

// ============================================================================
// Props
// ============================================================================

interface PChainTransactionDetailPageProps {
  txId: string;
  network?: 'mainnet' | 'fuji';
}

// ============================================================================
// Constants
// ============================================================================

const THEME_COLOR = "#E84142";

// ============================================================================
// Helpers
// ============================================================================

function formatAvax(avax: number): string {
  if (avax === 0) return '0';
  if (avax < 0.000001) return '<0.000001';
  return avax.toLocaleString(undefined, { maximumFractionDigits: 9 });
}

function shortenId(id: string, startChars = 10, endChars = 8): string {
  if (!id) return '';
  if (id.length <= startChars + endChars + 3) return id;
  return `${id.slice(0, startChars)}...${id.slice(-endChars)}`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Committed':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' };
    case 'Processing':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' };
    case 'Dropped':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' };
    default:
      return { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' };
  }
}

function getTxTypeIcon(type: string) {
  switch (type) {
    case 'AddValidatorTx':
    case 'AddPermissionlessValidatorTx':
      return <ShieldCheck className="w-4 h-4" />;
    case 'AddDelegatorTx':
    case 'AddPermissionlessDelegatorTx':
      return <Users className="w-4 h-4" />;
    case 'CreateSubnetTx':
    case 'TransformSubnetTx':
    case 'ConvertSubnetToL1Tx':
      return <Network className="w-4 h-4" />;
    case 'CreateChainTx':
      return <Link2 className="w-4 h-4" />;
    case 'ExportTx':
      return <ArrowUpRight className="w-4 h-4" />;
    case 'ImportTx':
      return <ArrowDownLeft className="w-4 h-4" />;
    // L1 Validator types (Etna upgrade)
    case 'RegisterL1ValidatorTx':
      return <UserPlus className="w-4 h-4" />;
    case 'DisableL1ValidatorTx':
      return <UserMinus className="w-4 h-4" />;
    case 'SetL1ValidatorWeightTx':
      return <Scale className="w-4 h-4" />;
    case 'IncreaseL1ValidatorBalanceTx':
      return <Wallet className="w-4 h-4" />;
    default:
      return <ArrowRightLeft className="w-4 h-4" />;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function ValidatorInfoSection({ decoded }: { decoded: DecodedTransaction }) {
  if (!decoded.validator) return null;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" style={{ color: THEME_COLOR }} />
        Validator Details
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Node ID:</span>
          <div className="font-mono text-zinc-900 dark:text-white break-all">
            {decoded.validator.nodeId}
          </div>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Stake Amount:</span>
          <div className="font-medium text-zinc-900 dark:text-white">
            {formatAvax(decoded.validator.weight)} AVAX
          </div>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Start Time:</span>
          <div className="text-zinc-900 dark:text-white">
            {new Date(decoded.validator.startTime).toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">End Time:</span>
          <div className="text-zinc-900 dark:text-white">
            {new Date(decoded.validator.endTime).toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Duration:</span>
          <div className="text-zinc-900 dark:text-white">{decoded.validator.duration}</div>
        </div>
        {decoded.delegationFee !== undefined && (
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Delegation Fee:</span>
            <div className="text-zinc-900 dark:text-white">{decoded.delegationFee}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

function GenesisDataSection({ genesisData, chainName }: { genesisData: string; chainName?: string }) {
  const [showGenesis, setShowGenesis] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Try to decode and format genesis data (it's usually base64 encoded JSON)
  const formattedGenesis = (() => {
    try {
      // Try to decode base64
      const decoded = atob(genesisData);
      // Try to parse as JSON
      const json = JSON.parse(decoded);
      return JSON.stringify(json, null, 2);
    } catch {
      // If not valid base64/JSON, show raw data
      return genesisData;
    }
  })();
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedGenesis);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const handleDownload = () => {
    const blob = new Blob([formattedGenesis], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genesis${chainName ? `-${chainName.toLowerCase().replace(/\s+/g, '-')}` : ''}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
          <FileCode className="w-4 h-4" style={{ color: THEME_COLOR }} />
          Genesis Data
        </h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copySuccess ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGenesis(!showGenesis)}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
            style={{ borderColor: THEME_COLOR, color: THEME_COLOR }}
          >
            {showGenesis ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showGenesis ? 'Hide' : 'View'}
          </Button>
        </div>
      </div>
      
      {showGenesis && (
        <div className="mt-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto max-h-96 overflow-y-auto">
          <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {formattedGenesis}
          </pre>
        </div>
      )}
    </div>
  );
}

function InputOutputSection({ 
  inputs, 
  outputs, 
  network,
}: { 
  inputs: DecodedInput[]; 
  outputs: DecodedOutput[];
  network: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayInputs = showAll ? inputs : inputs.slice(0, 3);
  const displayOutputs = showAll ? outputs : outputs.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Inputs */}
      {inputs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4" style={{ color: THEME_COLOR }} />
            Inputs ({inputs.length})
          </h4>
          <div className="space-y-2">
            {displayInputs.map((input, i) => (
              <div 
                key={i} 
                className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-zinc-500">{shortenId(input.txId)}:{input.outputIndex}</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{formatAvax(input.amount)} AVAX</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {outputs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" style={{ color: THEME_COLOR }} />
            Outputs ({outputs.length})
          </h4>
          <div className="space-y-2">
            {displayOutputs.map((output, i) => (
              <div 
                key={i} 
                className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-zinc-900 dark:text-white">{formatAvax(output.amount)} AVAX</span>
                </div>
                <div className="text-xs text-zinc-500 space-y-1">
                  {output.addresses.map((addr, j) => (
                    <Link
                      key={j}
                      href={`/explorer/p-chain/address/${addr}?network=${network}`}
                      className="block font-mono hover:underline cursor-pointer"
                      style={{ color: THEME_COLOR }}
                    >
                      {addr}
                    </Link>
                  ))}
                  {output.locktime > 0 && (
                    <div className="text-zinc-400">Locktime: {new Date(output.locktime * 1000).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show More */}
      {(inputs.length > 3 || outputs.length > 3) && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-sm font-medium cursor-pointer"
          style={{ color: THEME_COLOR }}
        >
          {showAll ? 'Show Less' : `Show All (${inputs.length} inputs, ${outputs.length} outputs)`}
          {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PChainTransactionDetailPage({ txId, network = 'mainnet' }: PChainTransactionDetailPageProps) {
  const [data, setData] = useState<TransactionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const fetchTransaction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/explorer/p-chain/tx/${txId}?network=${network}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transaction');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [txId, network]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  if (loading) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <div className="space-y-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-5 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchTransaction} className="cursor-pointer">Retry</Button>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(data?.status || 'Unknown');
  const decoded = data?.decoded;

  return (
    <>
      {/* Transaction Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            Transaction Details
          </h2>
          {data && (
            <span 
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
            >
              {data.status === 'Committed' && <Check className="w-3 h-3" />}
              {data.status === 'Dropped' && <X className="w-3 h-3" />}
              {data.status === 'Processing' && <Clock className="w-3 h-3" />}
              {data.status}
            </span>
          )}
        </div>
      </div>

      {/* Transaction Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Transaction ID */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label="Transaction Hash"
              themeColor={THEME_COLOR}
              value={
                <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                  {data?.txId}
                </span>
              }
              copyValue={data?.txId}
            />

            {/* Transaction Type */}
            <DetailRow
              icon={getTxTypeIcon(data?.type || '')}
              label="Type"
              themeColor={THEME_COLOR}
              value={
                <span 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
                  style={{ 
                    backgroundColor: `${data?.typeColor}15`,
                    color: data?.typeColor 
                  }}
                >
                  {getTxTypeIcon(data?.type || '')}
                  {data?.typeDescription}
                </span>
              }
            />

            {/* Summary */}
            <DetailRow
              icon={<FileText className="w-4 h-4" />}
              label="Summary"
              themeColor={THEME_COLOR}
              value={
                <span className="text-sm text-zinc-900 dark:text-white">
                  {data?.summary}
                </span>
              }
            />

            {/* Fee */}
            <DetailRow
              icon={<Coins className="w-4 h-4" />}
              label="Transaction Fee"
              themeColor={THEME_COLOR}
              value={
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {formatAvax(decoded?.fee || 0)} AVAX
                </span>
              }
            />

            {/* Validator Info */}
            {decoded?.validator && (
              <div className="pt-2">
                <ValidatorInfoSection decoded={decoded} />
              </div>
            )}

            {/* Network ID */}
            {decoded?.networkId && (
              <DetailRow
                icon={<Network className="w-4 h-4" />}
                label="Network ID"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {decoded.networkId}
                  </span>
                }
              />
            )}

            {/* Rewards Owner */}
            {decoded?.rewardsOwner && (
              <DetailRow
                icon={<Users className="w-4 h-4" />}
                label="Rewards Owner"
                themeColor={THEME_COLOR}
                value={
                  <div className="text-sm space-y-1">
                    {decoded.rewardsOwner.addresses.map((addr, i) => (
                      <Link
                        key={i}
                        href={`/explorer/p-chain/address/${addr}?network=${network}`}
                        className="block font-mono hover:underline cursor-pointer"
                        style={{ color: THEME_COLOR }}
                      >
                        {addr}
                      </Link>
                    ))}
                    <div className="text-xs text-zinc-500">
                      Threshold: {decoded.rewardsOwner.threshold}
                    </div>
                  </div>
                }
              />
            )}

            {/* Subnet ID */}
            {decoded?.subnetId && (
              <DetailRow
                icon={<Network className="w-4 h-4" />}
                label="Subnet ID"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                    {decoded.subnetId}
                  </span>
                }
                copyValue={decoded.subnetId}
              />
            )}

            {/* Chain Name */}
            {decoded?.chainName && (
              <DetailRow
                icon={<Link2 className="w-4 h-4" />}
                label="Chain Name"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {decoded.chainName}
                  </span>
                }
              />
            )}

            {/* VM ID */}
            {decoded?.vmId && (
              <DetailRow
                icon={<FileCode className="w-4 h-4" />}
                label="VM ID"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                    {decoded.vmId}
                  </span>
                }
                copyValue={decoded.vmId}
              />
            )}

            {/* Genesis Data - for CreateChainTx */}
            {data?.type === 'CreateChainTx' && decoded?.genesisData && (
              <GenesisDataSection genesisData={decoded.genesisData} chainName={decoded.chainName} />
            )}

            {/* L1 Validator Fields */}
            {decoded?.validationId && (
              <DetailRow
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Validation ID"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                    {decoded.validationId}
                  </span>
                }
                copyValue={decoded.validationId}
              />
            )}
            {decoded?.balance !== undefined && (
              <DetailRow
                icon={<Wallet className="w-4 h-4" />}
                label="Balance"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {formatAvax(decoded.balance)} AVAX
                  </span>
                }
              />
            )}
            {decoded?.l1ValidatorWeight !== undefined && (
              <DetailRow
                icon={<Scale className="w-4 h-4" />}
                label="Weight"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {decoded.l1ValidatorWeight.toLocaleString()}
                  </span>
                }
              />
            )}

            {/* Source/Destination Chain */}
            {decoded?.destinationChain && (
              <DetailRow
                icon={<ArrowUpRight className="w-4 h-4" />}
                label="Destination Chain"
                themeColor={THEME_COLOR}
                value={
                  <div className="flex flex-col gap-1">
                    <span 
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium w-fit"
                      style={{ backgroundColor: `${THEME_COLOR}15`, color: THEME_COLOR }}
                    >
                      {decoded.destinationChainName || 'Unknown Chain'}
                    </span>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 break-all">
                      {decoded.destinationChain}
                    </span>
                  </div>
                }
                copyValue={decoded.destinationChain}
              />
            )}
            {decoded?.sourceChain && (
              <DetailRow
                icon={<ArrowDownLeft className="w-4 h-4" />}
                label="Source Chain"
                themeColor={THEME_COLOR}
                value={
                  <div className="flex flex-col gap-1">
                    <span 
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium w-fit"
                      style={{ backgroundColor: `${THEME_COLOR}15`, color: THEME_COLOR }}
                    >
                      {decoded.sourceChainName || 'Unknown Chain'}
                    </span>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 break-all">
                      {decoded.sourceChain}
                    </span>
                  </div>
                }
                copyValue={decoded.sourceChain}
              />
            )}

            {/* Signatures */}
            {decoded?.signatureCount && decoded.signatureCount > 0 && (
              <DetailRow
                icon={<Check className="w-4 h-4" />}
                label="Signatures"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {decoded.signatureCount} signature{decoded.signatureCount !== 1 ? 's' : ''}
                  </span>
                }
              />
            )}

            {/* Raw Transaction Data - Hidden by default */}
            {decoded?.raw && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: THEME_COLOR }}
                >
                  {showMore ? 'Hide Raw Data' : 'Show Raw Data'}
                  {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showMore && (
                  <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                    <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {JSON.stringify(decoded.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inputs and Outputs - Separate Card */}
      {decoded && (decoded.inputs.length > 0 || decoded.outputs.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: THEME_COLOR }} />
                Inputs & Outputs
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <InputOutputSection 
                inputs={decoded.inputs} 
                outputs={decoded.outputs}
                network={network}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
