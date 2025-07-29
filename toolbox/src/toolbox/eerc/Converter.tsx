import React, { useState, useEffect } from "react";
import {
  type CompatiblePublicClient,
  type CompatibleWalletClient,
  useEERC,
} from "../../../local-eerc-sdk/src";
import {
  useAccount,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
  useReadContracts
} from "wagmi";
import { MAX_UINT256, DEMO_TOKEN_ABI as erc20Abi, ENCRYPTED_TOKEN_ABI, REGISTRAR_ABI } from "./pkg/constants";

import { avalancheFuji } from "viem/chains";
import {
  CIRCUIT_CONFIG,
  CONTRACTS,
  type EERCMode,
  EXPLORER_BASE_URL,
  EXPLORER_BASE_URL_TX,
} from "./config/contracts";
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useWalletStore } from "../../stores/walletStore";
import { useViemChainStore } from "../../stores/toolboxStore";

// Simple solution: Use the original SDK but provide better error handling
const useSimpleEERC = (
  publicClient: CompatiblePublicClient,
  walletClient: CompatibleWalletClient,
  contractAddress: string,
  circuitConfig: any
) => {
  const originalHook = useEERC(publicClient, walletClient, contractAddress, circuitConfig);
  
  // Simple register function with better error handling
  const simpleRegister = async () => {
    try {
      console.log("Attempting registration with original eERC SDK...");
      return await originalHook.register();
    } catch (error: any) {
      if (error?.message?.includes('InvalidProof')) {
        console.error("=== eERC SDK Proof Format Issue ===");
        console.error("The @avalabs/eerc-sdk v1.0.1 has a known bug:");
        console.error("- It generates proofs correctly");
        console.error("- But converts them to hex strings instead of numbers");
        console.error("- The smart contract expects numbers (bigint)");
        console.error("");
        console.error("=== Solutions ===");
        console.error("1. Fork the SDK and fix the generateSnarkjsProof function");
        console.error("2. Use a different contract that accepts hex format");
        console.error("3. Wait for a fixed version of the SDK");
        console.error("");
        console.error("=== Quick Fix ===");
        console.error("In temp-eerc-sdk/src/EERC.ts, around line 1175:");
        console.error("Replace the return statement with:");
        console.error("return {");
        console.error("  proofPoints: {");
        console.error("    a: convertArray(rawCalldata[0]),");
        console.error("    b: convertArray(rawCalldata[1]),");
        console.error("    c: convertArray(rawCalldata[2]),");
        console.error("  },");
        console.error("  publicSignals: convertArray(rawCalldata[3]),");
        console.error("};");
        
        throw new Error(
          "eERC SDK Proof Format Issue: The SDK converts proof data to hex strings instead of numbers. " +
          "This is a known bug in @avalabs/eerc-sdk v1.0.1. " +
          "The contract expects numbers (bigint) but receives hex strings, causing InvalidProof() errors."
        );
      }
      throw error;
    }
  };
  
  return {
    ...originalHook,
    register: simpleRegister
  };
};

export default function Converter() {
  const publicClient = usePublicClient({ chainId: avalancheFuji.id });
  const [mode, setMode] = useState<EERCMode>("converter");
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Project's custom wallet system
  const { coreWalletClient, publicClient: projectPublicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();

  // use fixed eerc hook (for SDK compatibility with proof format fix)
  const {
    owner,
    symbol,
    isAuditorKeySet,
    auditorPublicKey,
    isRegistered,
    isDecryptionKeySet,
    generateDecryptionKey,
    register: eercRegister,
    useEncryptedBalance,
    isAddressRegistered,
    publicKey,
    isInitialized,
    
  } = useEERC(
    publicClient as CompatiblePublicClient,
    walletClient as CompatibleWalletClient,
    mode === "converter" ? CONTRACTS.EERC_CONVERTER : CONTRACTS.EERC_STANDALONE,
    CIRCUIT_CONFIG
  );

  // Debug: Log the contract address being used
  useEffect(() => {
    console.log("eERC SDK Contract Address:", mode === "converter" ? CONTRACTS.EERC_CONVERTER : CONTRACTS.EERC_STANDALONE);
    console.log("eERC SDK Circuit Config:", CIRCUIT_CONFIG);
  }, [mode]);

  // Check if current address is registered
  const [isCurrentAddressRegistered, setIsCurrentAddressRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // ERC20 token state
  const [erc20Balance, setErc20Balance] = useState<bigint>(0n);
  const [erc20Symbol, setErc20Symbol] = useState<string>("");
  const [erc20Decimals, setErc20Decimals] = useState<number>(18);
  const [timeUntilNextRequest, setTimeUntilNextRequest] = useState<bigint>(0n);
  const [isRequestingTokens, setIsRequestingTokens] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Auditor public key state
  const [auditorPublicKeyData, setAuditorPublicKeyData] = useState<{ x: bigint; y: bigint } | null>(null);

  // User public key state
  const [userPublicKeyData, setUserPublicKeyData] = useState<{ x: bigint; y: bigint } | null>(null);
  const [registrarAddress, setRegistrarAddress] = useState<string | null>(null);
  const [isGeneratingPrivateKey, setIsGeneratingPrivateKey] = useState(false);

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Use useReadContracts to fetch ERC20 data
  const { data: erc20Data, isLoading: erc20Loading, refetch: refetchErc20Data } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.ERC20 as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: CONTRACTS.ERC20 as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address: CONTRACTS.ERC20 as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletEVMAddress as `0x${string}`],
      },
      {
        address: CONTRACTS.ERC20 as `0x${string}`,
        abi: erc20Abi,
        functionName: "timeUntilNextRequest",
        args: [walletEVMAddress as `0x${string}`],
      },
    ],
    query: {
      enabled: !!walletEVMAddress,
    },
  });

  // Fetch registrar address
  const { data: registrarAddressResult, isLoading: registrarAddressLoading } = useReadContract({
    address: CONTRACTS.EERC_CONVERTER as `0x${string}`,
    abi: ENCRYPTED_TOKEN_ABI,
    functionName: "registrar",
    query: {
      enabled: true,
    },
  });

  // Fetch auditor public key
  const { data: auditorPublicKeyResult, isLoading: auditorPublicKeyLoading } = useReadContract({
    address: CONTRACTS.EERC_CONVERTER as `0x${string}`,
    abi: ENCRYPTED_TOKEN_ABI,
    functionName: "auditorPublicKey",
    query: {
      enabled: true,
    },
  });

  // Fetch user public key from registrar
  const { data: userPublicKeyResult, isLoading: userPublicKeyLoading } = useReadContract({
    address: registrarAddress as `0x${string}`,
    abi: REGISTRAR_ABI,
    functionName: "getUserPublicKey",
    args: [walletEVMAddress as `0x${string}`],
    query: {
      enabled: !!registrarAddress && !!walletEVMAddress,
    },
  });

  // Update registrar address state
  useEffect(() => {
    if (registrarAddressResult) {
      setRegistrarAddress(registrarAddressResult as string);
    }
  }, [registrarAddressResult]);

  // Update auditor public key state
  useEffect(() => {
    if (auditorPublicKeyResult && Array.isArray(auditorPublicKeyResult) && auditorPublicKeyResult.length >= 2) {
      setAuditorPublicKeyData({
        x: auditorPublicKeyResult[0] as bigint,
        y: auditorPublicKeyResult[1] as bigint,
      });
    }
  }, [auditorPublicKeyResult]);

  // Update user public key state
  useEffect(() => {
    if (userPublicKeyResult && Array.isArray(userPublicKeyResult) && userPublicKeyResult.length >= 2) {
      setUserPublicKeyData({
        x: userPublicKeyResult[0] as bigint,
        y: userPublicKeyResult[1] as bigint,
      });
    }
  }, [userPublicKeyResult]);

  // Update state when erc20Data changes
  useEffect(() => {
    if (erc20Data && erc20Data.length === 4) {
      setErc20Symbol(erc20Data[0].result as string);
      setErc20Decimals(erc20Data[1].result as number);
      setErc20Balance(erc20Data[2].result as bigint);
      setTimeUntilNextRequest(erc20Data[3].result as bigint);
    }
  }, [erc20Data]);

  useEffect(() => {
    const checkRegistration = async () => {
      if (!walletEVMAddress || !isAddressRegistered) return;
      
      setLoading(true);
      try {
        const registrationResult = await isAddressRegistered(walletEVMAddress as `0x${string}`);
        const isRegistered = typeof registrationResult === 'boolean' ? registrationResult : registrationResult.isRegistered;
        setIsCurrentAddressRegistered(isRegistered);
      } catch (error) {
        console.error("Error checking registration:", error);
        setIsCurrentAddressRegistered(false);
      } finally {
        setLoading(false);
      }
    };

    checkRegistration();
  }, [walletEVMAddress, isAddressRegistered]);

  const handleRequestTokens = async () => {
    if (!walletEVMAddress || isRequestingTokens || timeUntilNextRequest !== 0n || !coreWalletClient || !viemChain) return;
    
    setIsRequestingTokens(true);
    try {
      // Use the project's custom wallet client instead of wagmi
      const hash = await coreWalletClient.writeContract({
        address: CONTRACTS.ERC20 as `0x${string}`,
        abi: erc20Abi,
        functionName: "requestTokens",
        args: [],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000), // Adjust gas as needed
      });

      // Wait for transaction receipt
      const receipt = await projectPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        // Refresh data after successful request
        await refetchErc20Data();
      }
    } catch (error) {
      console.error("Error requesting tokens:", error);
    } finally {
      setIsRequestingTokens(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACTS.ERC20);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const formatBalance = (balance: bigint, decimals: number) => {
    const divisor = BigInt(10 ** decimals);
    const whole = balance / divisor;
    const fraction = balance % divisor;
    
    if (fraction === 0n) {
      return whole.toString();
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0');
    return `${whole}.${fractionStr.slice(0, 4)}`;
  };

  const handleGeneratePrivateKey = async () => {
    if (!walletEVMAddress || isGeneratingPrivateKey) return;
    
    setIsGeneratingPrivateKey(true);
    try {
      await generateDecryptionKey();
      // You can add a success message here if needed
      console.log("Private key generated successfully");
    } catch (error) {
      console.error("Error generating private key:", error);
    } finally {
      setIsGeneratingPrivateKey(false);
    }
  };

  // Convert hex proof format to number format for contract
  const convertProofToNumbers = (proof: any) => {
    const convertHexToBigInt = (hex: string) => {
      if (typeof hex === 'string' && hex.startsWith('0x')) {
        return BigInt(hex);
      }
      return BigInt(hex);
    };

    const convertArray = (arr: any[]): any[] => {
      return arr.map(item => {
        if (Array.isArray(item)) {
          return convertArray(item);
        }
        return convertHexToBigInt(item);
      });
    };

    return {
      proofPoints: {
        a: convertArray(proof.proofPoints.a),
        b: convertArray(proof.proofPoints.b),
        c: convertArray(proof.proofPoints.c)
      },
      publicSignals: convertArray(proof.publicSignals)
    };
  };

  // Direct contract call with proper proof format
  const registerWithDirectCall = async () => {
    if (!walletEVMAddress || !coreWalletClient || !viemChain) {
      throw new Error("Missing wallet connection");
    }

    try {
      // First, try to get the proof from the SDK
      console.log("Generating proof using eERC SDK...");
      
      // We need to access the SDK's internal proof generation
      // This is a workaround since the SDK's register function has the hex conversion issue
      
      // For now, let's try to call the contract directly with a manual proof
      // This is a temporary solution until we can fix the SDK
      
      console.log("Attempting direct contract call with manual proof generation...");
      
      // This would require implementing the proof generation manually
      // or finding a way to extract the raw proof from the SDK before hex conversion
      
      throw new Error("Direct contract call not yet implemented. Need to extract raw proof from SDK.");
      
    } catch (error) {
      console.error("Direct contract call failed:", error);
      throw error;
    }
  };

  const handleRegister = async () => {
    if (!walletEVMAddress || isRegistering || isCurrentAddressRegistered || !coreWalletClient || !viemChain) return;
    
    setIsRegistering(true);
    try {
      console.log("=== eERC Registration Debug ===");
      console.log("Contract Address:", CONTRACTS.EERC_CONVERTER);
      console.log("Circuit Config:", CIRCUIT_CONFIG);
      console.log("Wallet Address:", walletEVMAddress);
      console.log("Chain ID:", viemChain?.id);
      console.log("Is Initialized:", isInitialized);
      console.log("Public Key:", publicKey);
      
      // Use the eERC SDK's register function
      const { transactionHash, key } = await eercRegister();
      console.log("Registration Result:", { key, transactionHash });
      setTxHash(transactionHash as `0x${string}`);
      console.log("Registration successful:", transactionHash);
      
      // Wait for transaction receipt
      const receipt = await projectPublicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
      if (receipt.status === 'success') {
        // Refresh registration status
        const checkRegistration = async () => {
          if (!walletEVMAddress || !isAddressRegistered) return;
          
          try {
            const registrationResult = await isAddressRegistered(walletEVMAddress as `0x${string}`);
            const isRegistered = typeof registrationResult === 'boolean' ? registrationResult : registrationResult.isRegistered;
            setIsCurrentAddressRegistered(isRegistered);
          } catch (error) {
            console.error("Error checking registration:", error);
          }
        };
        
        // Wait a bit for the blockchain to update, then check registration
        setTimeout(checkRegistration, 2000);
      }
    } catch (error: any) {
      console.error("Registration failed:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        stack: error?.stack
      });
      
      // If the error is about InvalidProof, try to debug the proof format
      if (error?.message?.includes('InvalidProof')) {
        console.log("=== Proof Format Debug ===");
        console.log("The eERC SDK might be sending hex strings instead of numbers.");
        console.log("This is a known issue with some eERC SDK versions.");
        console.log("The contract expects proof data as numbers (bigint), not hex strings.");
      }
      
      // You can add a toast notification here if needed
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Converter Privacy Token (eERC)</h2>
        <p className="text-zinc-600 dark:text-zinc-300">
          Interact with eERC tokens in converter mode, allowing conversion between public and private tokens as needed.
        </p>
      </div>

      {/* Registration Status */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Registration Status</h3>
        
        {!walletEVMAddress ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">Please connect your wallet to check registration status</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400 mx-auto mb-4"></div>
            <p className="text-zinc-500 dark:text-zinc-400">Checking registration status...</p>
          </div>
        ) : isCurrentAddressRegistered ? (
          <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-green-800 dark:text-green-200">Address Registered</h4>
              <p className="text-sm text-green-700 dark:text-green-300">Your address is registered with the eERC contract</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Address Not Registered</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">Your address is not registered with the eERC contract</p>
              </div>
            </div>

            {/* Registration Button */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">Registration</h4>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                Register your wallet address with the eERC contract to gain access to all privacy features and the ability to 
                generate your BabyJubJub public key. This is a one-time step.
              </p>
              <button
                type="button"
                className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isRegistering
                    ? "bg-zinc-400 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                } ${isRegistering ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isRegistering || !walletEVMAddress}
                onClick={handleRegister}
              >
                {isRegistering ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Registering...
                  </div>
                ) : (
                  "Register Wallet"
                )}
              </button>
              {txHash && (
                <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                  Registration Tx Hash: <a href={`${EXPLORER_BASE_URL_TX}${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash}</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auditor Public Key Card */}
      <div className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm ${
        !isCurrentAddressRegistered ? 'opacity-50' : ''
      }`}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Auditor Public Key (BabyJubJub)</h3>
        
        {!isCurrentAddressRegistered ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Registration Required</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Please register first to access auditor public key information
            </p>
          </div>
        ) : auditorPublicKeyLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400 mx-auto mb-4"></div>
            <p className="text-zinc-500 dark:text-zinc-400">Loading auditor public key...</p>
          </div>
        ) : auditorPublicKeyData ? (
          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">BabyJubJub Curve Point</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">X Coordinate</label>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded px-3 py-2">
                    <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono break-all">
                      {auditorPublicKeyData.x.toString()}
                    </code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Y Coordinate</label>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded px-3 py-2">
                    <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono break-all">
                      {auditorPublicKeyData.y.toString()}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">No auditor public key available</p>
          </div>
        )}
      </div>

      {/* User Public Key Card */}
      <div className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm ${
        !isCurrentAddressRegistered ? 'opacity-50' : ''
      }`}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">User Public Key (BabyJubJub)</h3>
        
        {!isCurrentAddressRegistered ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Registration Required</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Please register first to access your public key and privacy features
            </p>
          </div>
        ) : registrarAddressLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400 mx-auto mb-4"></div>
            <p className="text-zinc-500 dark:text-zinc-400">Loading registrar address...</p>
          </div>
        ) : !registrarAddress ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">No registrar address available</p>
          </div>
        ) : !walletEVMAddress ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">Please connect your wallet to view your public key</p>
          </div>
        ) : userPublicKeyLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400 mx-auto mb-4"></div>
            <p className="text-zinc-500 dark:text-zinc-400">Loading user public key...</p>
          </div>
        ) : userPublicKeyData ? (
          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">BabyJubJub Curve Point</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">X Coordinate</label>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded px-3 py-2">
                    <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono break-all">
                      {userPublicKeyData.x.toString()}
                    </code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Y Coordinate</label>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded px-3 py-2">
                    <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono break-all">
                      {userPublicKeyData.y.toString()}
                    </code>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Your Privacy Key</h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                This is your BabyJubJub public key used for privacy-preserving operations in eERC. 
                It enables you to perform confidential transactions while maintaining the ability to 
                prove transaction validity without revealing sensitive information.
              </p>
            </div>

            {/* Private Key Generation Button */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">Private Key Management</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Generate your private decryption key to enable privacy-preserving operations. This key allows you to 
                decrypt transaction details and perform confidential transfers.
              </p>
              <button
                type="button"
                className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDecryptionKeySet
                    ? "bg-zinc-400 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                } ${isGeneratingPrivateKey ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isDecryptionKeySet || isGeneratingPrivateKey || !walletEVMAddress}
                onClick={handleGeneratePrivateKey}
              >
                {isGeneratingPrivateKey ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating Private Key...
                  </div>
                ) : isDecryptionKeySet ? (
                  "Private Key Generated ✓"
                ) : (
                  "Generate Private Key"
                )}
              </button>
              {isDecryptionKeySet && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Your private decryption key has been generated and is ready for use.
                </p>
              )}
                         </div>
            </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">No user public key found</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              You may need to register first to generate your BabyJubJub public key
            </p>
          </div>
        )}
      </div>

      {/* ERC20 Token Card */}
      <div className={`bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md rounded-xl p-6 hover:shadow-xl transition-all duration-300 ${
        !isCurrentAddressRegistered ? 'opacity-50' : ''
      }`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <img
              src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
              alt="ERC20 Token"
              className="w-6 h-6"
            />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">ERC20 Token</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">For eERC converter operations</p>
          </div>
        </div>
        
        {!isCurrentAddressRegistered ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Registration Required</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Please register first to access ERC20 token features
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">Token Symbol: {erc20Symbol || "Loading..."}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">Decimals: {erc20Decimals}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">Balance: {formatBalance(erc20Balance, erc20Decimals)} {erc20Symbol}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRequestTokens}
                disabled={isRequestingTokens || timeUntilNextRequest !== 0n}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  timeUntilNextRequest !== 0n
                    ? "bg-zinc-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                } ${isRequestingTokens ? "opacity-50 cursor-not-allowed" : ""}`}
                title={timeUntilNextRequest !== 0n ? `Available in ${timeUntilNextRequest} seconds` : "Request test tokens"}
              >
                {isRequestingTokens ? "Requesting..." : "Request Tokens"}
              </button>

              <a
                href={`${EXPLORER_BASE_URL}${CONTRACTS.ERC20}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View in Explorer
              </a>

              <button
                onClick={copyAddress}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2"
                title="Copy contract address"
              >
                {copiedAddress ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Address
                  </>
                )}
              </button>
            </div>

            {/* Contract Address */}
            <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Contract Address:</span>
                <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono break-all">
                  {CONTRACTS.ERC20}
                </code>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contract Information */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Contract Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Contract Address:</span>
            <code className="text-sm text-zinc-900 dark:text-zinc-100 font-mono">
              {CONTRACTS.EERC_CONVERTER}
            </code>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Mode:</span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100 font-medium">Converter</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Network:</span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100 font-medium">Avalanche Fuji Testnet</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center">
        <a href="#standalonePrivacyTokenFlow">
          <button className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors duration-200 font-medium">
            Explore Standalone Privacy Token Flow
          </button>
        </a>
      </div>
    </div>
  );
} 