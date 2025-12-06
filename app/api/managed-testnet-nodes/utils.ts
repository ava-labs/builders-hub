import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { ServiceErrorSchema } from './types';
import { utils } from '@avalabs/avalanchejs';

export async function getUserId(): Promise<{ userId: string | null; error?: NextResponse }> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    return { userId: 'dev-user-id' };
  }
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please sign in to access managed testnet nodes'
        },
        { status: 401 }
      )
    };
  }
  return { userId: session.user.id };
}

// Validation result type for detailed error messages
export type SubnetIdValidationResult = {
  valid: boolean;
  error?: string;
};

// Validate subnet ID using Base58Check (same as Avalanche uses)
export function validateSubnetId(subnetId: string): boolean {
  const result = validateSubnetIdWithDetails(subnetId);
  return result.valid;
}

// Detailed validation with specific error messages
export function validateSubnetIdWithDetails(subnetId: string): SubnetIdValidationResult {
  // Check basic type and emptiness
  if (typeof subnetId !== 'string' || !subnetId.trim()) {
    return { valid: false, error: 'Subnet ID is required' };
  }

  // Check length range (Base58Check encoded 32-byte IDs are typically 43-50 characters)
  if (subnetId.length < 40 || subnetId.length > 60) {
    return {
      valid: false,
      error: `Invalid subnet ID length (${subnetId.length} characters). Expected 40-60 characters.`
    };
  }

  // Base58 character set validation (no 0, O, I, l)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  if (!base58Regex.test(subnetId)) {
    // Find the invalid characters for a helpful error message
    const invalidChars = subnetId.split('').filter(c => !base58Regex.test(c));
    const uniqueInvalid = [...new Set(invalidChars)].join(', ');
    return {
      valid: false,
      error: `Invalid characters in subnet ID: ${uniqueInvalid}. Subnet IDs use Base58 encoding (excludes 0, O, I, l).`
    };
  }

  // Validate Base58Check format and checksum using avalanchejs
  try {
    utils.base58check.decode(subnetId);
    return { valid: true };
  } catch (error) {
    // Checksum validation failed
    return {
      valid: false,
      error: 'Invalid subnet ID checksum. Please verify the ID is correct.'
    };
  }
}

export function toDateFromEpoch(epoch: number): Date {
  const ms = epoch > 1e12 ? epoch : epoch * 1000;
  return new Date(ms);
}

type RateLimitConfig = {
  dev: { windowMs: number; max: number };
  prod: { windowMs: number; max: number };
  identifier: () => Promise<string>;
};

export function rateLimited(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return rateLimit(handler, {
    windowMs: isDevelopment ? config.dev.windowMs : config.prod.windowMs,
    maxRequests: isDevelopment ? config.dev.max : config.prod.max,
    identifier: config.identifier
  });
}

export const NODE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function jsonOk(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonError(status: number, message: string, error?: unknown) {
  if (error) {
    try {
      // eslint-disable-next-line no-console
      console.error(message, typeof error === 'string' ? error.slice(0, 500) : error);
    } catch {}
  }
  return NextResponse.json({ error: 'Error', message }, { status });
}

// Extracts a useful error message from a non-OK Response from the external service
export async function extractServiceErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = await response.json();
      const parsed = ServiceErrorSchema.safeParse(body);
      if (parsed.success) {
        return parsed.data.error || parsed.data.message || null;
      }
    } catch {}
  } else {
    try {
      const text = await response.text();
      if (text) return text.slice(0, 200);
    } catch {}
  }
  return null;
}



