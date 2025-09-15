import { cn } from "../lib/utils"; // Assuming you have a utility for class names


interface NoteProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'destructive' | 'warning';
    className?: string;
}

export const Note = ({ children, variant = 'default', className }: NoteProps) => {
    const variantClasses = {
        default: 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
        success: 'border-green-500 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300',
        destructive: 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300',
        warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300',
    };

    return (
        <div className={cn("border-l-4 p-4 rounded-md my-4", variantClasses[variant], className)}>
            <div className="ml-3">
                <div className="text-sm">
                    {children}
                </div>
            </div>
        </div>
    );
};
