'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore, useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useState, useEffect, useRef, useId } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import ProxyAdminABI from '@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json';
import TransparentUpgradeableProxyABI from '@/contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json';
import { getSubnetInfo } from '@/components/toolbox/coreViem/utils/glacier';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { Check, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ADMIN_SLOT, implementationProblem } from './proxyTarget';
import { proxyAdminSubnetId, savedProxyAdminFor, savedProxyAdminProblem } from './savedProxyAdmin';

// Pre-deployed proxy address on L1s created via Builder Console
const GENESIS_PROXY_ADDRESS = '0xfacade0000000000000000000000000000000000';

// OpenZeppelin v4.9.0 source URLs
const OZ_VERSION = 'v4.9.0';
const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'TransparentUpgradeableProxy',
    filename: 'TransparentUpgradeableProxy.sol',
    url: `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${OZ_VERSION}/contracts/proxy/transparent/TransparentUpgradeableProxy.sol`,
    description: 'EIP-1967 compliant proxy that delegates calls to an implementation contract while preserving state.',
  },
  {
    name: 'ProxyAdmin',
    filename: 'ProxyAdmin.sol',
    url: `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${OZ_VERSION}/contracts/proxy/transparent/ProxyAdmin.sol`,
    description:
      'Manages proxy upgrades. For production, this should be a multisig since it controls the validator manager implementation.',
  },
];

/** viem's one-line message where it has one. */
const errorText = (err: unknown) =>
  (err as { shortMessage?: string })?.shortMessage ?? (err instanceof Error ? err.message : String(err));

const metadata: ConsoleToolMetadata = {
  title: 'Proxy Setup',
  description: 'Upgrade or deploy the TransparentUpgradeableProxy for the ValidatorManager',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ProxySetup({ onSuccess }: BaseConsoleToolProps) {
  const { validatorManagerAddress, setValidatorManagerAddress } = useToolboxStore();
  const setCreateChainManagerAddress = useCreateChainStore()((state) => state.setManagerAddress);
  const flowSubnetId = useCreateChainStore()((state) => state.subnetId);
  const savedProxyAdmin = useCreateChainStore()((state) => state.proxyAdmin);
  const setSavedProxyAdmin = useCreateChainStore()((state) => state.setProxyAdmin);
  const selectedL1 = useSelectedL1();
  const { walletChainId, walletEVMAddress } = useWalletStore();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const chainPublicClient = useChainPublicClient();

  const fieldId = useId();
  const isCChain = walletChainId === 43113 || walletChainId === 43114;

  // Upgrade state. The C-Chain has no genesis proxy, so the field starts empty there.
  const [proxyAddress, setProxyAddress] = useState<string>(() => (isCChain ? '' : GENESIS_PROXY_ADDRESS));
  // True after the user types in the Proxy Address field. Until then the page
  // sets the field for the wallet's chain: empty on the C-Chain, the genesis
  // proxy on an L1. The standalone flow does not remount this page on a chain switch.
  const userTypedProxyAddress = useRef(false);
  useEffect(() => {
    if (walletChainId === 0 || userTypedProxyAddress.current) return;
    setProxyAddress(isCChain ? '' : GENESIS_PROXY_ADDRESS);
  }, [walletChainId, isCChain]);
  const [proxyAdminAddress, setProxyAdminAddress] = useState<string>('');
  const [currentImplementation, setCurrentImplementation] = useState<string>('');
  const [desiredImplementation, setDesiredImplementation] = useState<string>('');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isLoadingProxyInfo, setIsLoadingProxyInfo] = useState(false);
  const [proxyError, setProxyError] = useState<string>('');

  // Deploy state. Default the section OPEN when we're on C-Chain (43113
  // Fuji / 43114 Mainnet). There's no `0xfacade…` genesis proxy to
  // upgrade, so "Deploy New Proxy" is the only path forward. On L1s
  // created through the Builder Console the genesis proxy exists and
  // Upgrade is the default.
  const [showDeploySection, setShowDeploySection] = useState<boolean>(isCChain);

  // `walletChainId` is often 0 on first render (WalletSync hasn't synced
  // wagmi state yet), so the `useState` initializer above can see the
  // wrong value and default to Upgrade. This one-shot effect re-syncs the
  // default once the chain id first becomes non-zero, and then steps out
  // of the way. Any later manual toggle or chain switch is respected.
  const autoDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (autoDefaultAppliedRef.current) return;
    if (walletChainId === 0) return;
    autoDefaultAppliedRef.current = true;
    setShowDeploySection(isCChain);
  }, [walletChainId, isCChain]);
  const [isDeployingProxyAdmin, setIsDeployingProxyAdmin] = useState(false);
  const [isDeployingProxy, setIsDeployingProxy] = useState(false);
  const [newProxyAdminAddress, setNewProxyAdminAddress] = useState<string>('');
  const [newProxyAddress, setNewProxyAddress] = useState<string>('');
  const [deployImplementationAddress, setDeployImplementationAddress] = useState<string>('');
  const [implementationError, setImplementationError] = useState<string | null>(null);
  const [isCheckingImplementation, setIsCheckingImplementation] = useState(false);
  const [deployImplementationError, setDeployImplementationError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [savedProxyAdminError, setSavedProxyAdminError] = useState<string | null>(null);

  // A ProxyAdmin deployed here belongs to the wallet's chain and to one L1.
  // The deploy results on screen are cleared when either one changes.
  const adminSubnetId = proxyAdminSubnetId(selectedL1?.subnetId, flowSubnetId);
  const deployScopeKey = `${walletChainId}:${adminSubnetId}`;
  const deployScopeRef = useRef(deployScopeKey);
  useEffect(() => {
    if (deployScopeRef.current === deployScopeKey) return;
    deployScopeRef.current = deployScopeKey;
    setNewProxyAdminAddress('');
    setNewProxyAddress('');
    setSavedProxyAdminError(null);
  }, [deployScopeKey]);

  // After a reload between the two deploys, show the ProxyAdmin that this page
  // deployed, once the chain confirms it. A failed check removes the saved address.
  const savedProxyAdminAddress = savedProxyAdminFor(savedProxyAdmin, walletChainId, adminSubnetId);
  const isCheckingSavedProxyAdmin =
    !!savedProxyAdminAddress && savedProxyAdminAddress !== newProxyAdminAddress && !savedProxyAdminError;
  useEffect(() => {
    if (!savedProxyAdminAddress || savedProxyAdminAddress === newProxyAdminAddress) return;
    if (!chainPublicClient || !walletEVMAddress) return;
    let cancelled = false;
    savedProxyAdminProblem(chainPublicClient, savedProxyAdminAddress, walletEVMAddress)
      .then((problem) => {
        if (cancelled) return;
        setShowDeploySection(true);
        if (problem) {
          setSavedProxyAdmin(null);
          setSavedProxyAdminError(problem);
          return;
        }
        setSavedProxyAdminError(null);
        setNewProxyAdminAddress(savedProxyAdminAddress);
      })
      .catch(() => {
        if (cancelled) return;
        setShowDeploySection(true);
        setSavedProxyAdminError(
          `Could not check the ProxyAdmin that this page deployed earlier (${savedProxyAdminAddress}). Check the network, then reload the page.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [savedProxyAdminAddress, newProxyAdminAddress, chainPublicClient, walletEVMAddress]);

  // Load proxy address from selected L1
  useEffect(() => {
    let cancelled = false;
    (async function () {
      try {
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) return;

        const info = await getSubnetInfo(subnetId);
        const contractAddress = info.l1ValidatorManagerDetails?.contractAddress;
        if (contractAddress && !cancelled) {
          userTypedProxyAddress.current = false;
          setProxyAddress(contractAddress);
        }
      } catch (error) {
        console.error('Failed to load L1 info:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedL1?.subnetId]);

  // Pre-fill desired implementation from store. After an upgrade the store
  // holds the proxy itself (downstream steps want the proxy), and a proxy
  // upgraded to itself stops working.
  const prefilledImplementation = useRef<string | null>(null);
  useEffect(() => {
    if (
      validatorManagerAddress &&
      !desiredImplementation &&
      validatorManagerAddress.toLowerCase() !== proxyAddress.toLowerCase()
    ) {
      prefilledImplementation.current = validatorManagerAddress;
      setDesiredImplementation(validatorManagerAddress);
    }
  }, [validatorManagerAddress, desiredImplementation, proxyAddress]);

  // The prefill can run before the proxy address is known. When the value
  // turns out to be the proxy, drop it; a value the user typed stays.
  useEffect(() => {
    const prefilled = prefilledImplementation.current;
    if (prefilled && desiredImplementation === prefilled && prefilled.toLowerCase() === proxyAddress.toLowerCase()) {
      prefilledImplementation.current = null;
      setDesiredImplementation('');
    }
  }, [desiredImplementation, proxyAddress]);

  // A proxy that already points at an implementation is set up: show it as
  // up to date instead of asking for an implementation again.
  useEffect(() => {
    if (desiredImplementation || !currentImplementation || !chainPublicClient) return;
    let cancelled = false;
    implementationProblem(chainPublicClient, proxyAddress, currentImplementation)
      .then((problem) => {
        if (!cancelled && problem === null) setDesiredImplementation(currentImplementation);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentImplementation, desiredImplementation, proxyAddress, chainPublicClient]);

  // The upgrade target must be an implementation: not the proxy itself, and
  // not another proxy.
  useEffect(() => {
    setImplementationError(null);
    if (!desiredImplementation || !chainPublicClient) {
      setIsCheckingImplementation(false);
      return;
    }
    let cancelled = false;
    setIsCheckingImplementation(true);
    implementationProblem(chainPublicClient, proxyAddress, desiredImplementation)
      .then((problem) => {
        if (!cancelled) setImplementationError(problem);
      })
      .catch(() => {
        if (!cancelled) setImplementationError('Could not read this address. Check the network and try again.');
      })
      .finally(() => {
        if (!cancelled) setIsCheckingImplementation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [desiredImplementation, proxyAddress, chainPublicClient]);

  // The same holds for the implementation of a new proxy.
  useEffect(() => {
    setDeployImplementationError(null);
    if (!deployImplementationAddress || !chainPublicClient) return;
    let cancelled = false;
    implementationProblem(chainPublicClient, '', deployImplementationAddress)
      .then((problem) => {
        if (!cancelled) setDeployImplementationError(problem);
      })
      .catch(() => {
        if (!cancelled) setDeployImplementationError('Could not read this address. Check the network and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [deployImplementationAddress, chainPublicClient]);

  // Pre-fill the Deploy New Proxy "implementation" field too. This is the
  // same ValidatorManager address the user just deployed in the previous
  // step. The Deploy path needs it to initialize the TransparentUpgradeable-
  // Proxy. Guarding on empty string so a user who manually cleared or
  // overrode the field doesn't get clobbered.
  useEffect(() => {
    if (validatorManagerAddress && !deployImplementationAddress) {
      setDeployImplementationAddress(validatorManagerAddress);
    }
  }, [validatorManagerAddress, deployImplementationAddress]);

  // Read proxy info when address changes. Nothing sits at the genesis proxy
  // address on the C-Chain: a read there shows an error before the user acts.
  useEffect(() => {
    if (!proxyAddress || (isCChain && proxyAddress === GENESIS_PROXY_ADDRESS)) {
      // Clear the values of an earlier read, for example the L1's proxy before a switch to the C-Chain
      setProxyAdminAddress('');
      setCurrentImplementation('');
      setProxyError('');
      return;
    }
    readProxyInfo(proxyAddress);
  }, [proxyAddress, walletChainId]);

  async function readProxyInfo(address: string) {
    if (!chainPublicClient) {
      setProxyError('Chain not configured. Connect your wallet to the target L1.');
      return;
    }

    setIsLoadingProxyInfo(true);
    setProxyError('');
    setProxyAdminAddress('');
    setCurrentImplementation('');

    try {
      // Read admin from EIP-1967 storage slot
      const adminData = await chainPublicClient.getStorageAt({
        address: address as `0x${string}`,
        slot: ADMIN_SLOT as `0x${string}`,
      });

      if (!adminData || adminData === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        setProxyError('No proxy admin found at this address. The contract may not be an EIP-1967 proxy.');
        return;
      }

      const adminAddress = `0x${adminData.slice(-40)}`;
      setProxyAdminAddress(adminAddress);

      // Read current implementation
      try {
        const implementation = await chainPublicClient.readContract({
          address: adminAddress as `0x${string}`,
          abi: ProxyAdminABI.abi,
          functionName: 'getProxyImplementation',
          args: [address],
        });
        setCurrentImplementation(implementation as string);
      } catch {
        setProxyError('Failed to read current implementation. ProxyAdmin may not be compatible.');
      }
    } catch {
      setProxyError("Failed to read proxy storage. Make sure you're connected to the correct network.");
    } finally {
      setIsLoadingProxyInfo(false);
    }
  }

  async function handleUpgrade() {
    if (!desiredImplementation || !proxyAddress || !proxyAdminAddress || !chainPublicClient) return;

    setIsUpgrading(true);
    setTxError(null);
    try {
      const problem = await implementationProblem(chainPublicClient, proxyAddress, desiredImplementation);
      if (problem) {
        setImplementationError(problem);
        return;
      }
      if (!walletClient) throw new Error('Wallet not connected');
      const upgradePromise = walletClient.writeContract({
        address: proxyAdminAddress as `0x${string}`,
        abi: ProxyAdminABI.abi,
        functionName: 'upgrade',
        args: [proxyAddress, desiredImplementation as `0x${string}`],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: 'call', name: 'Upgrade Proxy' }, upgradePromise, viemChain ?? undefined);

      const hash = await upgradePromise;
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error('The upgrade transaction reverted. The proxy still points at its old implementation.');
      }
      await readProxyInfo(proxyAddress);
      // Update BOTH stores with the PROXY address (not the implementation)
      // so downstream steps (Initialize, TransferOwnership) use the correct address.
      // toolboxStore: used by permissionless flows and as fallback
      setValidatorManagerAddress(proxyAddress);
      // createChainStore: used directly by permissioned Initialize step
      setCreateChainManagerAddress(proxyAddress);
      onSuccess?.();
    } catch (err) {
      setTxError(errorText(err));
    } finally {
      setIsUpgrading(false);
    }
  }

  async function deployProxyAdmin() {
    if (!chainPublicClient) throw new Error('Chain not configured');
    const scope = { evmChainId: walletChainId, subnetId: adminSubnetId };
    const scopeKey = deployScopeKey;

    setIsDeployingProxyAdmin(true);
    setNewProxyAdminAddress('');
    setTxError(null);

    try {
      if (!walletClient) throw new Error('Wallet not connected');
      const deployPromise = walletClient.deployContract({
        abi: ProxyAdminABI.abi as any,
        bytecode: ProxyAdminABI.bytecode.object as `0x${string}`,
        args: [],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: 'deploy', name: 'ProxyAdmin' }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash });
      // A reverted create still reports contractAddress, with no code behind it.
      if (receipt.status !== 'success' || !receipt.contractAddress) {
        throw new Error('The ProxyAdmin deployment reverted.');
      }
      // Saved so that a reload before the proxy deploy does not offer this deploy again
      setSavedProxyAdmin({ address: receipt.contractAddress, ...scope });
      setSavedProxyAdminError(null);
      // A chain or L1 switch during the deploy cleared the step: do not show this ProxyAdmin there
      if (deployScopeRef.current === scopeKey) {
        setNewProxyAdminAddress(receipt.contractAddress);
      }
    } catch (err) {
      setTxError(errorText(err));
    } finally {
      setIsDeployingProxyAdmin(false);
    }
  }

  async function deployTransparentProxy() {
    if (!deployImplementationAddress || !newProxyAdminAddress || !chainPublicClient) return;

    setIsDeployingProxy(true);
    setNewProxyAddress('');
    setTxError(null);

    try {
      const problem = await implementationProblem(chainPublicClient, '', deployImplementationAddress);
      if (problem) {
        setDeployImplementationError(problem);
        return;
      }
      if (!walletClient) throw new Error('Wallet not connected');
      const deployPromise = walletClient.deployContract({
        abi: TransparentUpgradeableProxyABI.abi as any,
        bytecode: TransparentUpgradeableProxyABI.bytecode.object as `0x${string}`,
        args: [deployImplementationAddress, newProxyAdminAddress, '0x'],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: 'deploy', name: 'TransparentUpgradeableProxy' }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success' || !receipt.contractAddress) {
        throw new Error('The proxy deployment reverted.');
      }
      setNewProxyAddress(receipt.contractAddress);
      // The ProxyAdmin now has its proxy: a reload must not offer a second proxy for it
      setSavedProxyAdmin(null);
      // Auto-fill the upgrade section with the new proxy
      userTypedProxyAddress.current = false;
      setProxyAddress(receipt.contractAddress);
      setShowDeploySection(false);
      // Persist the new proxy address to both stores so downstream steps
      // (Initialize, TransferOwnership) use it and it survives navigation/refresh.
      setValidatorManagerAddress(receipt.contractAddress);
      setCreateChainManagerAddress(receipt.contractAddress);
    } catch (err) {
      setTxError(errorText(err));
    } finally {
      setIsDeployingProxy(false);
    }
  }

  const isUpgradeNeeded =
    currentImplementation && desiredImplementation
      ? currentImplementation.toLowerCase() !== desiredImplementation.toLowerCase()
      : true;

  const canUpgrade =
    !!proxyAddress &&
    !!proxyAdminAddress &&
    !!desiredImplementation &&
    isUpgradeNeeded &&
    !proxyError &&
    !implementationError &&
    !isCheckingImplementation;
  const upgradeComplete = !isUpgradeNeeded && !!currentImplementation;

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Content area */}
        <div className="p-4 space-y-3">
          {txError && (
            <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 px-1">
              {txError}
            </p>
          )}
          {/* Upgrade Proxy Section (Primary) */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              upgradeComplete
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  upgradeComplete
                    ? 'bg-green-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {upgradeComplete ? <Check className="w-3 h-3" /> : '1'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Upgrade Proxy Implementation</h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Point proxy to ValidatorManager. Genesis proxy:{' '}
                  <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                    {GENESIS_PROXY_ADDRESS.slice(0, 12)}...
                  </code>
                </p>

                <div className="mt-3 space-y-2">
                  {/* Proxy Address + Info Row */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label
                        htmlFor={`${fieldId}-proxy`}
                        className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                      >
                        Proxy Address
                      </label>
                      <input
                        id={`${fieldId}-proxy`}
                        type="text"
                        value={proxyAddress}
                        onChange={(e) => {
                          userTypedProxyAddress.current = true;
                          setProxyAddress(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                        placeholder="0x..."
                      />
                    </div>
                    <button
                      onClick={() => readProxyInfo(proxyAddress)}
                      disabled={isLoadingProxyInfo || !proxyAddress}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      title="Read proxy info"
                      aria-label="Read proxy info"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isLoadingProxyInfo ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Proxy Info Display - Compact */}
                  {proxyError ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400 px-1">{proxyError}</p>
                  ) : proxyAdminAddress ? (
                    <div className="flex gap-4 text-[11px] px-1">
                      <span className="text-zinc-500">
                        Admin:{' '}
                        <code className="text-zinc-700 dark:text-zinc-300">
                          {proxyAdminAddress.slice(0, 8)}...{proxyAdminAddress.slice(-4)}
                        </code>
                      </span>
                      <span className="text-zinc-500">
                        Impl:{' '}
                        <code className="text-zinc-700 dark:text-zinc-300">
                          {currentImplementation
                            ? `${currentImplementation.slice(0, 8)}...${currentImplementation.slice(-4)}`
                            : 'None'}
                        </code>
                      </span>
                    </div>
                  ) : null}

                  {/* Desired Implementation Input */}
                  <div>
                    <label
                      htmlFor={`${fieldId}-implementation`}
                      className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      New Implementation (ValidatorManager)
                    </label>
                    <input
                      id={`${fieldId}-implementation`}
                      type="text"
                      value={desiredImplementation}
                      onChange={(e) => setDesiredImplementation(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                      placeholder="0x..."
                    />
                    {implementationError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 px-1">{implementationError}</p>
                    )}
                  </div>

                  {upgradeComplete ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Proxy is up to date</span>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleUpgrade}
                      loading={isUpgrading}
                      disabled={!canUpgrade || isUpgrading}
                      className="w-full"
                    >
                      {!proxyAdminAddress
                        ? 'Enter Proxy Address'
                        : !desiredImplementation
                          ? 'Enter Implementation'
                          : 'Upgrade Proxy'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deploy New Proxy Section (Optional/Advanced) */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDeploySection(!showDeploySection)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              {showDeploySection ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Deploy New Proxy
                <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  C-Chain / Custom
                </span>
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </button>

            {showDeploySection && (
              <div className="px-3 pb-3 space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                {/* Warning */}
                <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-lg">
                  Only for L1s without genesis proxy. Builder Console L1s have proxy at{' '}
                  <code>{GENESIS_PROXY_ADDRESS.slice(0, 10)}...</code>
                </p>
                {savedProxyAdminError && (
                  <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 px-1 break-words">
                    {savedProxyAdminError}
                  </p>
                )}

                {/* Two-column layout for deploy steps */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Step 1: Deploy ProxyAdmin */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-zinc-400">01</span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">ProxyAdmin</span>
                    </div>
                    {newProxyAdminAddress ? (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        <code className="text-[10px] font-mono text-zinc-500 truncate">
                          {newProxyAdminAddress.slice(0, 10)}...
                        </code>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={deployProxyAdmin}
                        loading={isDeployingProxyAdmin}
                        disabled={isDeployingProxyAdmin || isCheckingSavedProxyAdmin}
                        className="w-full text-xs py-1.5"
                      >
                        Deploy ProxyAdmin
                      </Button>
                    )}
                  </div>

                  {/* Step 2: Deploy Proxy */}
                  <div className={`space-y-1.5 ${!newProxyAdminAddress ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-zinc-400">02</span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Proxy</span>
                    </div>
                    {newProxyAddress ? (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        <code className="text-[10px] font-mono text-zinc-500 truncate">
                          {newProxyAddress.slice(0, 10)}...
                        </code>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={deployTransparentProxy}
                        loading={isDeployingProxy}
                        disabled={
                          !newProxyAdminAddress ||
                          !deployImplementationAddress ||
                          !!deployImplementationError ||
                          isDeployingProxy
                        }
                        className="w-full text-xs py-1.5"
                      >
                        Deploy Proxy
                      </Button>
                    )}
                  </div>
                </div>

                {/* Implementation input - full width below */}
                {!newProxyAddress && newProxyAdminAddress && (
                  <input
                    type="text"
                    value={deployImplementationAddress}
                    onChange={(e) => setDeployImplementationAddress(e.target.value)}
                    aria-label="Implementation address"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                    placeholder="Implementation address for proxy..."
                  />
                )}
                {!newProxyAddress && newProxyAdminAddress && deployImplementationError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 px-1">{deployImplementationError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <Link
            href="/docs/avalanche-l1s/validator-manager/contract"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Docs →
          </Link>
          <a
            href={`https://github.com/OpenZeppelin/openzeppelin-contracts/tree/${OZ_VERSION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            OpenZeppelin {OZ_VERSION}
          </a>
        </div>
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(ProxySetup, metadata);
