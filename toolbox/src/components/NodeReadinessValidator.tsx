import { useState } from "react";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { nipify } from "./HostInput";

interface NodeReadinessValidatorProps {
    // Required: parameters to generate the check command
    chainId: string;
    domain: string;

    // Optional: use debug trace instead of basic eth_chainId
    isDebugTrace?: boolean;

    // Action button configuration (optional)
    buttonText?: string;
    buttonClassName?: string;
    onAction?: () => void;

    // Immediate action on checkbox change (optional)
    onBootstrapCheckChange?: (checked: boolean) => void;

    // Additional content (like images, etc.)
    children?: React.ReactNode;
}



const generateCheckNodeCommand = (chainId: string, domain: string, isDebugTrace: boolean = false) => {
    let baseUrl;

    if (domain.startsWith("127.0.0.1")) {
        baseUrl = "http://" + domain;
    } else {
        baseUrl = "https://" + nipify(domain);
    }

    const method = isDebugTrace ? "debug_traceBlockByNumber" : "eth_chainId";
    const params = isDebugTrace ? '["latest", {}]' : '[]';

    return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"${method}", "params":${params}, "id":1 
}' -H 'content-type:application/json;' \\
${baseUrl}/ext/bc/${chainId}/rpc`;
};



export const NodeReadinessValidator = ({
    chainId,
    domain,
    isDebugTrace = false,
    buttonText,
    buttonClassName = "w-1/3",
    onAction,
    onBootstrapCheckChange,
    children
}: NodeReadinessValidatorProps) => {
    const [bootstrapChecked, setBootstrapChecked] = useState(false);

    const handleButtonClick = () => {
        if (!bootstrapChecked || !onAction) {
            return;
        }
        onAction();
    };

    const handleBootstrapCheckChange = (checked: boolean) => {
        setBootstrapChecked(checked);
        if (onBootstrapCheckChange) {
            onBootstrapCheckChange(checked);
        }
    };





    const basicCurlCommand = generateCheckNodeCommand(chainId, domain, false);
    const debugCurlCommand = generateCheckNodeCommand(chainId, domain, true);

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="space-y-4">
                    <p>During the bootstrapping process, the following command will return a 404 page not found error:</p>

                    <DynamicCodeBlock lang="bash" code={basicCurlCommand} />

                    <p>
                        Once bootstrapping is complete, it will return a response like <code>{'{"jsonrpc":"2.0","id":1,"result":"..."}'}</code>.
                    </p>
                </div>

                <Checkbox
                    label="AvalancheGo node is fully bootstrapped"
                    checked={bootstrapChecked}
                    onChange={handleBootstrapCheckChange}
                />
            </div>

            {bootstrapChecked && isDebugTrace && (
                <div className="space-y-4 mt-6">
                    <h4 className="text-lg font-semibold">Test Debug & Trace</h4>
                    <p>Now that your node is synced, you can test the debug and trace functionality:</p>

                    <DynamicCodeBlock lang="bash" code={debugCurlCommand} />

                    <p>Make sure you make at least one transaction on your chain, or it will error "genesis is untracable".</p>
                </div>
            )}

            {children}

            {buttonText && onAction && (
                <div className="flex justify-center">
                    <Button
                        onClick={handleButtonClick}
                        disabled={!bootstrapChecked}
                        className={buttonClassName}
                    >
                        {buttonText}
                    </Button>
                </div>
            )}
        </div>
    );
}; 