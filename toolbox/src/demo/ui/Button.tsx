import { LoaderCircle } from 'lucide-react';

export const Button = ({
    children,
    onClick,
    disabled,
    className = '',
    type = 'default',
    icon,
    loading = false
}: {
    children: React.ReactNode,
    onClick?: () => void,
    disabled?: boolean,
    className?: string,
    type?: 'default' | 'primary' | 'secondary' | 'danger',
    icon?: React.ReactNode,
    loading?: boolean
}) => {
    const buttonStyles = {
        default: 'bg-white hover:bg-gray-50 border border-gray-300  shadow-sm cursor-pointer dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:',
        primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer dark:bg-blue-700 dark:hover:bg-blue-800',
        secondary: 'bg-white hover:bg-gray-50 border border-gray-300  shadow-sm cursor-pointer dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer dark:bg-red-700 dark:hover:bg-red-800'
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`py-2 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center space-x-2 ${disabled || loading ? 'bg-gray-100 border border-gray-200 cursor-not-allowed opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:' : buttonStyles[type]
                } ${className}`}
        >
            {icon}
            <span>{children}</span>
            {loading && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            )}
        </button>
    );
};
