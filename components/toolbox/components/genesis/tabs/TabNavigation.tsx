interface TabNavigationProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isGenesisReady: boolean;
}

export function TabNavigation({ activeTab, setActiveTab, isGenesisReady }: TabNavigationProps) {
    const tabs = [
        { id: "config", label: "Configuration" },
        { id: "precompiles", label: "Precompiles" },
        { id: "preinstalls", label: "Pre-Deployed Contracts" },
        { id: "genesis", label: "Genesis JSON", disabled: !isGenesisReady }
    ];

    return (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex -mb-px">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`py-2 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                            activeTab === tab.id
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
} 