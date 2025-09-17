

export interface RegisterSubnetResponse {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    };
}

export interface NodeRegistration {
    id: string;
    subnet_id: string;
    blockchain_id: string;
    node_id: string;
    node_index: number | null;
    rpc_url: string;
    chain_name: string | null;
    created_at: string;
    expires_at: string;
    status: string;
    public_key?: string;
    proof_of_possession?: string;
}

export interface NodeStatusResponse {
    jsonrpc: string;
    result?: {
        nodes: NodeRegistration[];
        total: number;
    };
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

export interface TimeRemaining {
    days: number;
    hours: number;
    expired: boolean;
}

export interface StatusData {
    color: string;
    iconType: 'expired' | 'warning' | 'active';
    label: string;
}
