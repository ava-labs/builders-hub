import { useState } from 'react';
import { useL1LauncherStore } from '../../L1LauncherStore';
import { useWalletStore } from '../../../lib/walletStore';
import { Success } from '../../../components/Success';
import { Button } from '../../../components/Button';
import { useErrorBoundary } from 'react-error-boundary';
import { Note } from '../../../components/Note';

export default function CollectSignatures() {
    const {
        convertL1SignedWarpMessage,
        setConvertL1SignedWarpMessage,
        conversionId
    } = useL1LauncherStore();

    const [isLoading, setIsLoading] = useState(false);
    const { coreWalletClient } = useWalletStore();
    const { showBoundary } = useErrorBoundary()

    const onCollect = async () => {
        setIsLoading(true);
        try {
            const {
                message,
                justification,
                signingSubnetId
            } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionId });

            // Use the new API endpoint for signature aggregation
            //TODO: replace with the glacier SDK
            const signResponse = await fetch('https://glacier-api.avax.network/v1/signatureAggregator/fuji/aggregateSignatures', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    justification: justification,
                    quorumPercentage: 67,
                    signingSubnetId: signingSubnetId
                })
            });

            if (!signResponse.ok) {
                const errorText = await signResponse.text();
                throw new Error(errorText || `HTTP error! status: ${signResponse.status}`);
            }

            // const { signedMessage } = await signResponse.json();
            const respJson = await signResponse.json();
            const signedMessage = respJson['signedMessage'];
            setConvertL1SignedWarpMessage(`0x${signedMessage}`);
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`pb-2  mb-4`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium dark:text-white">Aggregate L1 Conversion WARP Signatures</h3>
            </div>

            <Success label="Signatures aggregated successfully" value={convertL1SignedWarpMessage} />

            {!convertL1SignedWarpMessage && (
                <Note variant="warning">
                    This will NOT work behind NAT. You need a real VM with a public IP and port 9651 open to gather signatures.
                </Note>
            )}

            {convertL1SignedWarpMessage && <span
                onClick={() => setConvertL1SignedWarpMessage('')}
                className='text-sm text-gray-500 cursor-pointer'
            >
                Reset
            </span>}

            {!convertL1SignedWarpMessage && (
                <Button
                    onClick={onCollect}
                    disabled={isLoading}
                >
                    {isLoading ? 'Collecting Signatures...' : 'Collect Signatures'}
                </Button>
            )}
        </div>
    );
}
