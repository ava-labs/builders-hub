"use client";

import { Container } from "@/components/toolbox/components/Container";
import Link from "next/link";

export default function DelegatePage() {
    return (
        <Container
            title="Delegate to Validator"
            description="Delegate tokens to an existing validator on your L1"
        >
            <div className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose the type of token you want to delegate:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/console/permissionless-l1s/delegate-native">
                        <div className="p-6 border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg cursor-pointer transition-all hover:shadow-md">
                            <h3 className="text-lg font-semibold mb-2">Native Token Delegation</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Delegate the L1's native token to a validator. You will earn native token rewards based on the validator's performance.
                            </p>
                            <div className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                Delegate Native Token →
                            </div>
                        </div>
                    </Link>

                    <Link href="/console/permissionless-l1s/delegate-erc20">
                        <div className="p-6 border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg cursor-pointer transition-all hover:shadow-md">
                            <h3 className="text-lg font-semibold mb-2">ERC20 Token Delegation</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Delegate a custom ERC20 token to a validator. You will earn ERC20 token rewards based on the validator's performance.
                            </p>
                            <div className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                Delegate ERC20 Token →
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Note:</strong> You can only delegate to validators that are already active on the network. Make sure the validator you want to delegate to has completed their registration.
                    </p>
                </div>
            </div>
        </Container>
    );
}
