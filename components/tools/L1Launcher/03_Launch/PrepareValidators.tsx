import { useL1LauncherWizardStore } from '../config/store';
import NextPrev from "@/components/tools/common/ui/NextPrev";
import Note from '@/components/tools/common/ui/Note';
import { useEffect, useState } from 'react';
import Pre from '@/components/tools/common/ui/Pre';
import OSSelectionTabs from '../../common/ui/OSSelectionTabs';

const dockerInstallInstructions: Record<string, string> = {
'Ubuntu/Debian': `sudo apt-get update && \\
    sudo apt-get install -y docker.io && \\
    sudo usermod -aG docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
'Amazon Linux 2023+': `sudo yum update -y && \\
    sudo yum install -y docker && \\
    sudo service docker start && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
'Fedora': `sudo dnf update -y && \\
    sudo dnf -y install docker && \\
    sudo systemctl start docker && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
}

export default function PrepareValidators() {
    const { nodesCount, goToNextStep, goToPreviousStep } = useL1LauncherWizardStore();
    const [activeOS, setActiveOS] = useState(Object.keys(dockerInstallInstructions)[0]);


    return <div className="space-y-12">
        <div>
            <h1 className="text-2xl font-medium mb-4">Prepare your Validator Nodes</h1>
            <p>This step will guide you through preparing your validator nodes. for long-lived environment we recommend using a infrastructure provider such as AWS or Google Cloud. For short-lived environments you can use your local machine or any other machine you have access to.</p>
        </div>


        <div>
            <strong>Requirements for validator nodes:</strong>
            <ul className="list-disc list-inside ml-4">
                <li>16GB RAM (you might try with 8GB)</li>
                <li>8 cores CPU (you might try 4 cores)</li>
                <li>
                    At least 100GB of any disk space (EBS or SSD), except for HDD
                </li>
                <li>
                    <strong>⚠️ Important:</strong> make sure port 9651 is open on your node!
                </li>
            </ul>
            If you are hosting the validators on AWS you can use t2.2xlarge EC2 instances.
        </div>

        <div>
            <h3 className="mb-4 font-medium">Docker</h3>
            <p className="mb-4">
                We will retrieve the binary images of <a href='https://github.com/ava-labs/avalanchego' target='_blank'>AvalancheGo</a> from the Docker Hub. Make sure you have Docker installed on your system. To install Docker on an AWS machine, run the following commands:
            </p>

            <OSSelectionTabs 
                operatingSystems={Object.keys(dockerInstallInstructions)} 
                activeOS={activeOS} 
                setActiveOS={setActiveOS} 
            />

            <Pre>
                {dockerInstallInstructions[activeOS]}
            </Pre>

            <p className="mb-4">
                If you do not want to use Docker, you can follow the instructions <a href="https://github.com/ava-labs/avalanchego?tab=readme-ov-file#installation" target="_blank">here</a>.
            </p>
        </div>


        <NodeSelector />

        <NextPrev nextDisabled={!nodesCount} onNext={goToNextStep} onPrev={goToPreviousStep} />
    </div>
}


const NodeSelector = () => {
    const { nodesCount, setNodesCount, userHasAdvancedBeyondStep } = useL1LauncherWizardStore();
    const [isCustomSelected, setIsCustomSelected] = useState(false);
    const [customNodeCount, setCustomNodeCount] = useState(2); // Default custom value

    // Check if user has advanced beyond this step
    const isLocked = userHasAdvancedBeyondStep('convert-to-l1');

    // Initialize custom selection if nodesCount doesn't match predefined options
    useEffect(() => {
        const predefinedCounts = [1, 3, 5];
        if (!predefinedCounts.includes(nodesCount)) {
            setIsCustomSelected(true);
            setCustomNodeCount(nodesCount);
        }
    }, []);

    const nodeConfigurations = {
        1: { colorClass: 'bg-red-100 text-red-800', badge: 'Development' },
        3: { colorClass: 'bg-green-100 text-green-800', badge: 'Testnet' },
        5: { colorClass: 'bg-blue-100 text-blue-800', badge: 'Mainnet' },
        'custom': { colorClass: 'bg-purple-100 text-purple-800', badge: 'Custom' },
    };

    // Handle radio button change
    const handleRadioChange = (value: string) => {
        if (value === 'custom') {
            setIsCustomSelected(true);
            setNodesCount(customNodeCount);
        } else {
            setIsCustomSelected(false);
            setNodesCount(Number(value));
        }
    };

    // Handle custom node count change
    const handleCustomNodeCountChange = (event: { target: { value: string; }; }) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value) && value > 0) {
            setCustomNodeCount(value);
            setNodesCount(value);
        }
    };

    return <div className="space-y-12">
        
        <div>
            <h3 className="mb-4 font-medium text-gray-900 dark:text-gray-100">How many nodes do you want to run?</h3>
            <ul className="mb-4 items-center w-full text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg sm:flex">
                {Object.entries(nodeConfigurations).map(([count, config]) => {
                    const isSelected = count === 'custom' 
                        ? isCustomSelected 
                        : !isCustomSelected && nodesCount === Number(count);
                    
                    return (
                        <li key={count} className="w-full border-b border-gray-200 dark:border-gray-700 sm:border-b-0 sm:border-r last:border-r-0">
                            <div className="flex items-center ps-3">
                                <input
                                    id={`nodes-${count}`}
                                    type="radio"
                                    checked={isSelected}
                                    onChange={() => handleRadioChange(count)}
                                    name="nodes-count"
                                    disabled={isLocked}
                                    className={`w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-0 
                                            ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                                />
                                <label
                                    htmlFor={`nodes-${count}`}
                                    className={`w-full py-3 ms-2 text-sm font-medium text-gray-900 dark:text-gray-100 
                                            ${isLocked ? 'cursor-not-allowed' : ''}`}
                                >
                                    {count !== 'custom' ? `${count} ${Number(count) === 1 ? 'Node' : 'Nodes'}` : 'Custom'}
                                    {config.badge && (
                                        <span className={`ms-2 ${config.colorClass} text-xs font-medium px-2.5 py-0.5 rounded-full`}>
                                            {config.badge}
                                        </span>
                                    )}
                                </label>
                            </div>
                        </li>
                    );
                })}
            </ul>
            
            {isCustomSelected && (
                <div className="mb-4">
                    <label htmlFor="custom-node-count" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        Enter number of nodes:
                    </label>
                    <input
                        type="number"
                        id="custom-node-count"
                        value={customNodeCount}
                        onChange={handleCustomNodeCountChange}
                        min="1"
                        disabled={isLocked}
                        className={`bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                    />
                </div>
            )}
            
            <Note>
                <p>
                    You will need 1 AVAX per node to pay for the continuous validator fees for the first month. Additionally, 0.5 AVAX for transaction fees. The total would be {nodesCount * 1 + 0.5} AVAX.
                </p>
            </Note>
        </div>
    </div>;
};