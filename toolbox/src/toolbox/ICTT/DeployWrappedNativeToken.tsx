"use client";

import WrappedNativeToken from "../../../contracts/icm-contracts/compiled/WrappedNativeToken.json";
import { useWalletStore } from "../../stores/walletStore";
import { useViemChainStore } from "../../stores/toolboxStore";
import { useSelectedL1 } from "../../stores/l1ListStore";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { Container } from "../../components/Container";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { Input } from "../../components/Input";
import { AmountInput } from "../../components/AmountInput";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";

export default function DeployWrappedNativeToken() {
    const { showBoundary } = useErrorBoundary();
    const selectedL1 = useSelectedL1()();
    const viemChain = useViemChainStore();
    const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } = useWalletStore();

    const [isDeploying, setIsDeploying] = useState(false);
    const [deployTx, setDeployTx] = useState<string | null>(null);
    const [wrappedTokenAddress, setWrappedTokenAddress] = useState<string>("");
    const [tokenSymbol, setTokenSymbol] = useState<string>(
        selectedL1?.coinName ? `W${selectedL1.coinName}` : "WCOIN"
    );

    const [decimals, setDecimals] = useState<number>(18);
    const [wrappedBalance, setWrappedBalance] = useState<bigint>(0n);

    const [wrapAmount, setWrapAmount] = useState<string>("");
    const [unwrapAmount, setUnwrapAmount] = useState<string>("");
    const [isWrapping, setIsWrapping] = useState(false);
    const [isUnwrapping, setIsUnwrapping] = useState(false);
    const [lastWrapTx, setLastWrapTx] = useState<string | null>(null);
    const [lastUnwrapTx, setLastUnwrapTx] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string>("");

    useEffect(() => {
        // Prefer L1 preset if available
        if (selectedL1?.wrappedTokenAddress && !wrappedTokenAddress) {
            setWrappedTokenAddress(selectedL1.wrappedTokenAddress);
        }
    }, [selectedL1?.wrappedTokenAddress]);

    // Fetch token metadata and user balance
    useEffect(() => {
        if (!wrappedTokenAddress || !viemChain) return;
        setLocalError("");
        const pc = createPublicClient({
            chain: viemChain,
            transport: http(viemChain.rpcUrls.default.http[0])
        });
        pc.readContract({
            address: wrappedTokenAddress as `0x${string}`,
            abi: WrappedNativeToken.abi,
            functionName: "decimals",
        })
            .then((res) => setDecimals(Number(res as bigint)))
            .catch(() => setDecimals(18));

        if (walletEVMAddress) {
            pc.readContract({
                address: wrappedTokenAddress as `0x${string}`,
                abi: WrappedNativeToken.abi,
                functionName: "balanceOf",
                args: [walletEVMAddress as `0x${string}`],
            }).then((res) => setWrappedBalance(res as bigint)).catch(() => setWrappedBalance(0n));
        }
    }, [wrappedTokenAddress, viemChain?.id, walletEVMAddress]);

    const formattedBalance = useMemo(() => formatUnits(wrappedBalance, decimals), [wrappedBalance, decimals]);

    async function handleDeploy() {
        setDeployTx(null);
        setLocalError("");
        if (!coreWalletClient || !viemChain) return;
        if (!tokenSymbol || tokenSymbol.trim().length === 0) {
            setLocalError("Symbol is required");
            return;
        }
        setIsDeploying(true);
        try {
            const pc = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0] || "")
            });
            const hash = await coreWalletClient.deployContract({
                abi: WrappedNativeToken.abi,
                bytecode: WrappedNativeToken.bytecode.object as `0x${string}`,
                args: [tokenSymbol],
                chain: viemChain,
            });
            setDeployTx(hash);
            const receipt = await pc.waitForTransactionReceipt({ hash });
            if (!receipt.contractAddress) throw new Error("No contract address in receipt");
            setWrappedTokenAddress(receipt.contractAddress);
        } catch (e: any) {
            setLocalError(e?.shortMessage || e?.message || String(e));
            showBoundary(e);
        } finally {
            setIsDeploying(false);
        }
    }

    async function handleWrap() {
        setLocalError("");
        setLastWrapTx(null);
        if (!coreWalletClient || !viemChain || !wrappedTokenAddress) return;
        if (!wrapAmount || Number(wrapAmount) <= 0) {
            setLocalError("Enter an amount to wrap");
            return;
        }
        setIsWrapping(true);
        try {
            const value = parseUnits(wrapAmount, decimals);
            const hash = await coreWalletClient.writeContract({
                address: wrappedTokenAddress as `0x${string}`,
                abi: WrappedNativeToken.abi,
                functionName: "deposit",
                value,
                chain: viemChain,
                account: coreWalletClient.account,
            });
            setLastWrapTx(hash);
        } catch (e: any) {
            setLocalError(e?.shortMessage || e?.message || String(e));
            showBoundary(e);
        } finally {
            setIsWrapping(false);
        }
    }

    async function handleUnwrap() {
        setLocalError("");
        setLastUnwrapTx(null);
        if (!coreWalletClient || !viemChain || !wrappedTokenAddress) return;
        if (!unwrapAmount || Number(unwrapAmount) <= 0) {
            setLocalError("Enter an amount to unwrap");
            return;
        }
        setIsUnwrapping(true);
        try {
            const amount = parseUnits(unwrapAmount, decimals);
            const hash = await coreWalletClient.writeContract({
                address: wrappedTokenAddress as `0x${string}`,
                abi: WrappedNativeToken.abi,
                functionName: "withdraw",
                args: [amount],
                chain: viemChain,
                account: coreWalletClient.account,
            });
            setLastUnwrapTx(hash);
        } catch (e: any) {
            setLocalError(e?.shortMessage || e?.message || String(e));
            showBoundary(e);
        } finally {
            setIsUnwrapping(false);
        }
    }

    return (
        <Container
            title="Deploy Wrapped Native Token"
            description={`Deploy a Wrapped Native Token (OpenZeppelin ERC‑20 style) and wrap/unwrap native coins on Chain ID: ${walletChainId}`}
        >
            <div className="space-y-4">
                <EVMAddressInput
                    label="Wrapped Token Address"
                    value={wrappedTokenAddress}
                    onChange={setWrappedTokenAddress}
                    helperText="Paste an existing wrapped token address or deploy a new one below."
                    disabled={isDeploying || isWrapping || isUnwrapping}
                />

                <Input
                    label="Token Symbol"
                    value={tokenSymbol}
                    onChange={setTokenSymbol}
                    disabled={isDeploying}
                    error={!tokenSymbol ? "Required" : undefined}
                    button={<Button onClick={() => setTokenSymbol(selectedL1?.coinName ? `W${selectedL1.coinName}` : "WCOIN")} stickLeft>Suggest</Button>}
                />

                <Button
                    variant={wrappedTokenAddress ? "secondary" : "primary"}
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying || !tokenSymbol}
                >
                    {wrappedTokenAddress ? "Re-Deploy Wrapped Token" : "Deploy Wrapped Token"}
                </Button>

                {deployTx && <Success label="Deployment Tx" value={deployTx} />}

                <hr />

                <div className="space-y-3">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">My Wrapped Balance: <span className="font-mono">{formattedBalance}</span></div>

                    <AmountInput
                        label={`Amount to Wrap (${selectedL1?.coinName || 'Native'})`}
                        value={wrapAmount}
                        onChange={setWrapAmount}
                        type="number"
                        min="0"
                        step={`0.${'0'.repeat((decimals || 18) - 1)}1`}
                        disabled={!wrappedTokenAddress || isWrapping}
                        button={<Button onClick={() => setWrapAmount("")} stickLeft variant="secondary">Clear</Button>}
                    />
                    <Button onClick={handleWrap} loading={isWrapping} disabled={!wrappedTokenAddress || isWrapping || !wrapAmount}>
                        Wrap
                    </Button>
                    {lastWrapTx && <Success label="Wrap Tx" value={lastWrapTx} />}

                    <AmountInput
                        label={`Amount to Unwrap (${selectedL1?.coinName || 'Native'})`}
                        value={unwrapAmount}
                        onChange={setUnwrapAmount}
                        type="number"
                        min="0"
                        step={`0.${'0'.repeat((decimals || 18) - 1)}1`}
                        disabled={!wrappedTokenAddress || isUnwrapping}
                        button={<Button onClick={() => setUnwrapAmount(formatUnits(wrappedBalance, decimals))} stickLeft>MAX</Button>}
                    />
                    <Button onClick={handleUnwrap} loading={isUnwrapping} disabled={!wrappedTokenAddress || isUnwrapping || !unwrapAmount}>
                        Unwrap
                    </Button>
                    {lastUnwrapTx && <Success label="Unwrap Tx" value={lastUnwrapTx} />}
                </div>

                {localError && (
                    <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>
                )}
            </div>
        </Container>
    );
}


