import { useMemo } from 'react';

export function useConfigHighlighting(highlightPath: string | null, configJson: string) {
    return useMemo(() => {
        if (!highlightPath || !configJson) return [];
        
        const lines = configJson.split('\n');
        const highlighted: number[] = [];
        
        if (highlightPath === 'relayerAddress') {
            lines.forEach((line, index) => {
                if (line.includes('"account-private-key"')) {
                    highlighted.push(index + 1);
                }
            });
        } else if (highlightPath === 'sources') {
            const startIdx = lines.findIndex(line => line.includes('"source-blockchains"'));
            if (startIdx >= 0) {
                highlighted.push(startIdx + 1);
                let braceCount = 0;
                let inArray = false;
                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes('[')) inArray = true;
                    if (inArray) {
                        if (line.includes('{')) braceCount++;
                        if (line.includes('}')) braceCount--;
                        highlighted.push(i + 1);
                        if (line.includes(']') && braceCount === 0) break;
                    }
                }
            }
        } else if (highlightPath === 'destinations') {
            const startIdx = lines.findIndex(line => line.includes('"destination-blockchains"'));
            if (startIdx >= 0) {
                highlighted.push(startIdx + 1);
                let braceCount = 0;
                let inArray = false;
                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes('[')) inArray = true;
                    if (inArray) {
                        if (line.includes('{')) braceCount++;
                        if (line.includes('}')) braceCount--;
                        highlighted.push(i + 1);
                        if (line.includes(']') && braceCount === 0) break;
                    }
                }
            }
        } else if (highlightPath === 'logLevel') {
            const idx = lines.findIndex(line => line.includes('"log-level"'));
            if (idx >= 0) highlighted.push(idx + 1);
        } else if (highlightPath === 'storage') {
            const idx = lines.findIndex(line => line.includes('"storage-location"'));
            if (idx >= 0) highlighted.push(idx + 1);
        } else if (highlightPath === 'processMissedBlocks') {
            const idx = lines.findIndex(line => line.includes('"process-missed-blocks"'));
            if (idx >= 0) highlighted.push(idx + 1);
        } else if (highlightPath === 'apiPort') {
            const idx = lines.findIndex(line => line.includes('"api-port"'));
            if (idx >= 0) highlighted.push(idx + 1);
        }
        
        return [...new Set(highlighted)];
    }, [highlightPath, configJson]);
}

