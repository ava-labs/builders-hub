interface LibraryRequirementStatusProps {
    libraryAddress: string | null;
    libraryName?: string;
}

export function LibraryRequirementStatus({
    libraryAddress,
    libraryName = "ValidatorMessages"
}: LibraryRequirementStatusProps) {
    if (!libraryAddress) {
        return (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-200">
                    <strong>Required:</strong> {libraryName} library must be deployed first.
                    Please go to the <strong>Validator Manager Setup</strong> section and deploy the {libraryName} library.
                </p>
            </div>
        );
    }

    return (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
            <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Ready:</strong> {libraryName} library found at: <code>{libraryAddress}</code>
            </p>
        </div>
    );
}
