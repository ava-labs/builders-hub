import { useState } from "react";
import { useL1ByChainId } from "../../stores/l1ListStore";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogHeader, 
    AlertDialogTitle 
} from "../AlertDialog"
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';


export const L1DetailsModal = ({
    blockchainId,
}: { blockchainId: string }) => {
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);

    const l1 = useL1ByChainId(blockchainId)();
    
    return l1 && (
        <>
            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            <div className="flex flex-row items-center gap-4">
                                {l1.logoUrl && (<img src={l1.logoUrl} alt="Chain Logo" className="h-12 w-12 rounded-full" />)}
                                <p>{l1.name}</p>
                            </div>
                            
                        </AlertDialogTitle>
                        <AlertDialogDescription>

                        </AlertDialogDescription>

                    </AlertDialogHeader>

                    <p>RPC:</p>
                    <DynamicCodeBlock lang="bash" code={l1.rpcUrl} />
                    
                    <p>EVM ChainID:</p>
                    <DynamicCodeBlock lang="bash" code={l1.evmChainId.toString()} />

                    <p>Avalanche BlockchainId:</p>
                    <DynamicCodeBlock lang="bash" code={l1.id} />
                    

                    {l1.validatorManagerAddress && (<><p>Validator ManagerAddress:</p>
                    <DynamicCodeBlock lang="bash" code={l1.validatorManagerAddress} /></>)}

                    {l1.wellKnownTeleporterRegistryAddress && (
                        <>
                            <p>Teleporter Registry:</p>
                            <DynamicCodeBlock lang="bash" code={l1.wellKnownTeleporterRegistryAddress} />
                        </>
                    )}

                    <AlertDialogFooter className="flex gap-2">
                        
                        <AlertDialogAction>OK</AlertDialogAction>
                        
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <button
                onClick={() => setIsAlertDialogOpen(true)}
                className={`px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors`}
                aria-label="Open L1 details"
            >
                L1 Details
            </button>
        </>
    );
};

