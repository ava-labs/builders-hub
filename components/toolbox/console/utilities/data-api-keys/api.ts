import {
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    ListApiKeysResponse,
    ApiKeyDetailsResponse,
} from './types';


export class GlacierApiClient {
    constructor(private jwt: string, private endpoint: string) { }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${this.endpoint}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.jwt}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message ||
                errorData.error ||
                `HTTP ${response.status}: ${response.statusText}`
            );
        }

        // Handle empty responses (like DELETE operations)
        const text = await response.text();
        if (!text) {
            return null as T;
        }

        return JSON.parse(text);
    }

    async listApiKeys(): Promise<ListApiKeysResponse> {
        return this.makeRequest<ListApiKeysResponse>('/internal/dt-api-keys');
    }

    async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
        return this.makeRequest<CreateApiKeyResponse>('/internal/dt-api-keys', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    async getApiKeyDetails(keyId: string): Promise<ApiKeyDetailsResponse> {
        return this.makeRequest<ApiKeyDetailsResponse>(`/internal/dt-api-keys/${keyId}`);
    }

    async deleteApiKey(keyId: string): Promise<void> {
        await this.makeRequest(`/internal/dt-api-keys/${keyId}`, {
            method: 'DELETE',
        });
    }
}
