import { useState } from 'react';

export function useCriticalError() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    return { setCriticalError };
}
