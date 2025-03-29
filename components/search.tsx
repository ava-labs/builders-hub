'use client';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import SearchDialog from 'trieve-fumadocs-adapter/components/dialog/search';
import { TrieveSDK } from 'trieve-ts-sdk';

const trieveClient = new TrieveSDK({
    apiKey: 'tr-DRwBhkLLDJGjRfVk3T9PgIPgVrcE2oKs',
    datasetId: '4948db5c-a7e7-423f-bf6a-0ac1ba7a2b76',
});

export default function CustomSearchDialog(props: SharedProps) {
    return <SearchDialog trieveClient={trieveClient} {...props} />;
}