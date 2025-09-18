import { ReactNode } from 'react';

interface TabsProps {
    tabs: string[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    className?: string;
    ariaLabel?: string;
    children?: ReactNode | ((activeTab: string) => ReactNode);
}

export function Tabs({
    tabs,
    activeTab,
    setActiveTab,
    className = '',
    ariaLabel = 'Tab navigation',
    children
}: TabsProps) {
    const renderContent = () => {
        if (!children) return null;

        if (typeof children === 'function') {
            return children(activeTab);
        }

        return children;
    };

    return (
        <div className={`${className}`}>
            <div className="border-b border-gray-200 dark:border-gray-700">
                <ul
                    className="flex flex-wrap -mb-px text-sm font-medium text-center"
                    role="tablist"
                    aria-label={ariaLabel}
                >
                    {tabs.map((tab) => {
                        const isActive = tab === activeTab;
                        return (
                            <li key={tab} role="presentation" className="mr-2">
                                <button
                                    className={`inline-block p-4 rounded-t-lg ${isActive
                                        ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-500 dark:border-blue-500 active'
                                        : 'hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 border-b-2 border-transparent'}`}
                                    onClick={() => setActiveTab(tab)}
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-controls={`${tab}-tab`}
                                    id={`${tab}-tab-btn`}
                                    type="button"
                                >
                                    {tab}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
            {renderContent() && (
                <div className="pt-1">
                    {renderContent()}
                </div>
            )}
        </div>
    );
}
