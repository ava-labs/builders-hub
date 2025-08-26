import { z } from 'zod';

export interface NodeInfo {
  nodeIndex: number;
  nodeInfo: {
    result: {
      nodeID: string;
      nodePOP: {
        publicKey: string;
        proofOfPossession: string;
      };
    };
  };
  dateCreated: number;
  expiresAt: number;
}

export interface SubnetStatusResponse {
  subnetId: string;
  nodes: NodeInfo[];
  error?: string;
  message?: string;
}

export interface CreateNodeRequest {
  subnetId: string;
  blockchainId: string;
}

// Zod schemas for runtime validation
export const NodeInfoSchema = z.object({
  nodeIndex: z.number().int().nonnegative(),
  nodeInfo: z.object({
    result: z.object({
      nodeID: z.string().min(40),
      nodePOP: z.object({
        publicKey: z.string().min(98),
        proofOfPossession: z.string().min(194)
      })
    })
  }),
  dateCreated: z.number(),
  expiresAt: z.number()
});

export const SubnetStatusResponseSchema = z.object({
  subnetId: z.string().min(49),
  nodes: z.array(NodeInfoSchema),
  error: z.string().optional(),
  message: z.string().optional()
});

export const ServiceErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional()
}).passthrough();


