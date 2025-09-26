export interface ApiKey {
    keyId: string;
    alias: string;
    customerId: string;
    productId: string;
    key?: string; // Only present on creation
}

export interface ApiKeyListItem {
    keyId: string;
    alias: string;
    customerId: string;
    productId: string;
}

export interface CreateApiKeyRequest {
    alias: string;
}

export interface CreateApiKeyResponse {
    keyId: string;
    alias: string;
    customerId: string;
    productId: string;
    key: string;
}

export interface ListApiKeysResponse {
    keys: ApiKeyListItem[];
    maxApiKeysAllowed: number;
}

export interface ApiKeyDetailsResponse {
    keyId: string;
    alias: string;
    customerId: string;
    productId: string;
}
