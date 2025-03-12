import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { CodeHighlighter } from './CodeHighlighter';

interface GithubEmbedProps {
    filePath: string;
    user: string;
    repo: string;
    branch?: string;
    maxHeight?: number;
}

export function GithubEmbed({ filePath, user, repo, maxHeight, branch }: GithubEmbedProps) {
    const [code, setCode] = useState<string>('');
    const [error, setError] = useState<string>('');

    const lang = filePath.split('.').pop()?.toLowerCase() || 'unknown';

    const sourceURL = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`;

    useEffect(() => {
        fetch(sourceURL)
            .then(response => response.text())
            .then(setCode)
            .catch(err => setError(err.message));
    }, [sourceURL]);

    if (error) {
        return <div className="text-red-500">Failed to load code: {error}</div>
    }

    if (!code) {
        return <div>Loading...</div>
    }

    const footer = (
        <a
            href={`https://github.com/${user}/${repo}/blob/${branch}/${filePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
        >
            {filePath} on {branch}
            <ExternalLink size={12} />
        </a>
    );

    return (
        <CodeHighlighter
            code={code}
            lang={lang}
            maxHeight={maxHeight}
            footer={footer}
            disableCopy={true}
        />
    );
}

