export interface ApiKeyListItem {
  keyId: string;
  alias: string;
  customerId: string;
  productId: string;
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
