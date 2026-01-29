"use client";

import { Container } from "@/components/toolbox/components/Container";
import Link from "next/link";

export default function StakePage() {
    return (
        <Container
            title="Stake Validator"
            description="Register and stake a new validator on your L1"
        >
            <div className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose the type of token you want to stake with:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/console/permissionless-l1s/stake-native">
                        <div className="p-6 border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg cursor-pointer transition-all hover:shadow-md">
                            <h3 className="text-lg font-semibold mb-2">Native Token Staking</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Stake with the L1's native token. The validator will lock native tokens as collateral and earn native token rewards.
                            </p>
                            <div className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                Stake with Native Token →
                            </div>
                        </div>
                    </Link>

                    <Link href="/console/permissionless-l1s/stake-erc20">
                        <div className="p-6 border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg cursor-pointer transition-all hover:shadow-md">
                            <h3 className="text-lg font-semibold mb-2">ERC20 Token Staking</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Stake with a custom ERC20 token. The validator will lock ERC20 tokens as collateral and earn ERC20 token rewards.
                            </p>
                            <div className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                Stake with ERC20 Token →
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Note:</strong> Make sure you've already set up your staking manager before staking validators. Visit the{" "}
                        <Link href="/console/permissionless-l1s/staking-manager-setup" className="underline">
                            Staking Manager Setup
                        </Link>{" "}
                        page if you haven't done this yet.
                    </p>
                </div>
            </div>
        </Container>
    );
}
