import { useState, useEffect } from 'react';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export function useRelayerKey() {
    const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedKey = sessionStorage.getItem('icm-relayer-private-key');
            if (storedKey) {
                setPrivateKey(storedKey as `0x${string}`);
            } else {
                const newKey = generatePrivateKey();
                sessionStorage.setItem('icm-relayer-private-key', newKey);
                setPrivateKey(newKey);
            }
        }
    }, []);

    const relayerAddress = privateKey ? privateKeyToAccount(privateKey).address : null;

    return { privateKey, relayerAddress };
}

