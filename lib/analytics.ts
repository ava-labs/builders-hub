/**
 * Centralized Analytics Utility for PostHog
 *
 * This module provides a type-safe, centralized way to track analytics events.
 * All events follow the naming convention: `{category}_{action}`
 *
 * Usage:
 * ```typescript
 * import { analytics } from '@/lib/analytics';
 *
 * // Track auth events
 * analytics.auth.otpRequested('user@example.com');
 *
 * // Track faucet events
 * analytics.faucet.claimSuccess(43113, 'Avalanche Fuji', '0x123...', '2');
 * ```
 */
import posthog from 'posthog-js';

// Event categories
export type EventCategory = 'auth' | 'faucet' | 'console' | 'docs' | 'error' | 'navigation';

// Social login providers
export type SocialProvider = 'google' | 'github' | 'x';

// Auth methods
export type AuthMethod = 'otp' | SocialProvider;

// Faucet types
export type FaucetType = 'evm' | 'pchain';

// Base event interface
export interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  properties?: Record<string, unknown>;
}

/**
 * Helper to safely extract email domain without exposing PII
 * @param email - Full email address
 * @returns Domain portion of email (e.g., "gmail.com")
 */
const getEmailDomain = (email: string): string => {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : 'unknown';
};

/**
 * Safely capture PostHog events with error handling
 * Handles cases where PostHog might not be initialized (SSR, blocked, etc.)
 */
const safeCapture = (eventName: string, properties?: Record<string, unknown>): void => {
  try {
    // Check if PostHog is available and initialized
    if (typeof window !== 'undefined' && posthog && typeof posthog.capture === 'function') {
      posthog.capture(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Analytics] Failed to capture event "${eventName}":`, error);
    }
  }
};

/**
 * Core track function for custom events
 */
const track = ({ category, action, properties }: AnalyticsEvent): void => {
  const eventName = `${category}_${action}`;
  safeCapture(eventName, properties);
};

/**
 * Centralized analytics object with convenience methods
 */
export const analytics = {
  /**
   * Core track function for custom events
   */
  track,

  /**
   * Authentication events
   */
  auth: {
    /**
     * Track when user requests OTP
     * @param email - User's email (only domain is tracked)
     */
    otpRequested: (email: string): void => {
      track({
        category: 'auth',
        action: 'otp_requested',
        properties: {
          email_domain: getEmailDomain(email),
        },
      });
    },

    /**
     * Track when OTP request fails
     * @param email - User's email (only domain is tracked)
     * @param errorMessage - Error message
     */
    otpRequestError: (email: string, errorMessage: string): void => {
      track({
        category: 'auth',
        action: 'otp_request_error',
        properties: {
          email_domain: getEmailDomain(email),
          error_message: errorMessage,
        },
      });
    },

    /**
     * Track successful OTP verification
     * @param email - User's email (only domain is tracked)
     */
    otpVerified: (email: string): void => {
      track({
        category: 'auth',
        action: 'otp_verified',
        properties: {
          email_domain: getEmailDomain(email),
        },
      });
    },

    /**
     * Track failed OTP verification
     * @param email - User's email (only domain is tracked)
     * @param reason - Failure reason (INVALID, EXPIRED, etc.)
     */
    otpVerificationFailed: (email: string, reason: string): void => {
      track({
        category: 'auth',
        action: 'otp_verification_failed',
        properties: {
          email_domain: getEmailDomain(email),
          failure_reason: reason,
        },
      });
    },

    /**
     * Track when user clicks a social login button
     * @param provider - Social provider (google, github, x)
     */
    socialLoginClicked: (provider: SocialProvider): void => {
      track({
        category: 'auth',
        action: 'social_login_clicked',
        properties: {
          provider,
        },
      });
    },

    /**
     * Track successful login (any method)
     * @param method - Auth method used (otp, google, github, x)
     */
    loginSuccess: (method: AuthMethod): void => {
      track({
        category: 'auth',
        action: 'login_success',
        properties: {
          method,
        },
      });
    },

    /**
     * Track logout
     */
    logout: (): void => {
      track({
        category: 'auth',
        action: 'logout',
        properties: {},
      });
    },
  },

  /**
   * Faucet events
   */
  faucet: {
    /**
     * Track when user starts a faucet claim
     * @param chainId - Chain ID
     * @param chainName - Human-readable chain name
     * @param faucetType - Type of faucet (evm or pchain)
     */
    claimStarted: (chainId: number | string, chainName: string, faucetType: FaucetType = 'evm'): void => {
      track({
        category: 'faucet',
        action: 'claim_started',
        properties: {
          chain_id: chainId,
          chain_name: chainName,
          faucet_type: faucetType,
        },
      });
    },

    /**
     * Track successful faucet claim
     * @param chainId - Chain ID
     * @param chainName - Human-readable chain name
     * @param txHash - Transaction hash (optional for P-Chain)
     * @param amount - Amount claimed
     * @param faucetType - Type of faucet (evm or pchain)
     */
    claimSuccess: (
      chainId: number | string,
      chainName: string,
      txHash: string | undefined,
      amount: string | undefined,
      faucetType: FaucetType = 'evm'
    ): void => {
      track({
        category: 'faucet',
        action: 'claim_success',
        properties: {
          chain_id: chainId,
          chain_name: chainName,
          ...(txHash && { tx_hash: txHash }),
          ...(amount && { amount }),
          faucet_type: faucetType,
        },
      });
    },

    /**
     * Track failed faucet claim
     * @param chainId - Chain ID
     * @param chainName - Human-readable chain name
     * @param errorMessage - Error message
     * @param faucetType - Type of faucet (evm or pchain)
     */
    claimError: (
      chainId: number | string,
      chainName: string,
      errorMessage: string,
      faucetType: FaucetType = 'evm'
    ): void => {
      track({
        category: 'faucet',
        action: 'claim_error',
        properties: {
          chain_id: chainId,
          chain_name: chainName,
          error_message: errorMessage,
          faucet_type: faucetType,
        },
      });
    },

    /**
     * Track rate limit hit
     * @param chainId - Chain ID
     * @param chainName - Human-readable chain name
     * @param faucetType - Type of faucet (evm or pchain)
     */
    rateLimited: (chainId: number | string, chainName: string, faucetType: FaucetType = 'evm'): void => {
      track({
        category: 'faucet',
        action: 'rate_limited',
        properties: {
          chain_id: chainId,
          chain_name: chainName,
          faucet_type: faucetType,
        },
      });
    },
  },

  /**
   * Console/toolbox events
   */
  console: {
    /**
     * Track when a console tool is opened
     * @param toolId - Unique tool identifier
     * @param toolPath - URL path to the tool
     */
    toolOpened: (toolId: string, toolPath: string): void => {
      track({
        category: 'console',
        action: 'tool_opened',
        properties: {
          tool_id: toolId,
          tool_path: toolPath,
        },
      });
    },

    /**
     * Track when a step in a multi-step flow is started
     * @param toolPath - URL path to the tool
     * @param stepIndex - Current step index (0-based)
     * @param stepKey - Step identifier key
     * @param stepTitle - Human-readable step title
     */
    stepStarted: (toolPath: string, stepIndex: number, stepKey: string, stepTitle: string): void => {
      track({
        category: 'console',
        action: 'step_started',
        properties: {
          tool_path: toolPath,
          step_index: stepIndex,
          step_key: stepKey,
          step_title: stepTitle,
        },
      });
    },

    /**
     * Track when a step in a multi-step flow is completed
     * @param toolPath - URL path to the tool
     * @param stepIndex - Current step index (0-based)
     * @param stepKey - Step identifier key
     * @param stepTitle - Human-readable step title
     */
    stepCompleted: (toolPath: string, stepIndex: number, stepKey: string, stepTitle: string): void => {
      track({
        category: 'console',
        action: 'step_completed',
        properties: {
          tool_path: toolPath,
          step_index: stepIndex,
          step_key: stepKey,
          step_title: stepTitle,
        },
      });
    },

    /**
     * Track when a multi-step flow is completed
     * @param toolPath - URL path to the tool
     * @param totalSteps - Total number of steps in the flow
     */
    flowCompleted: (toolPath: string, totalSteps: number): void => {
      track({
        category: 'console',
        action: 'flow_completed',
        properties: {
          tool_path: toolPath,
          total_steps: totalSteps,
        },
      });
    },
  },

  /**
   * Error events
   */
  error: {
    /**
     * Track console error boundary
     * @param error - The error that was caught
     * @param digest - Next.js error digest (optional)
     * @param pathname - Current pathname (optional)
     */
    consoleBoundary: (error: Error, digest?: string, pathname?: string): void => {
      track({
        category: 'error',
        action: 'console_boundary',
        properties: {
          error_name: error.name,
          error_message: error.message?.slice(0, 500), // Truncate for safety
          ...(digest && { error_digest: digest }),
          ...(pathname && { pathname }),
        },
      });
    },

    /**
     * Track toolbox error fallback
     * @param error - The error that was caught
     * @param pathname - Current pathname (optional)
     */
    toolboxBoundary: (error: Error, pathname?: string): void => {
      track({
        category: 'error',
        action: 'toolbox_boundary',
        properties: {
          error_name: error.name,
          error_message: error.message?.slice(0, 500), // Truncate for safety
          ...(pathname && { pathname }),
        },
      });
    },

    /**
     * Track generic error boundary
     * @param error - The error that was caught
     * @param componentStack - React component stack (optional)
     * @param context - Additional context (optional)
     */
    boundaryTriggered: (error: Error, componentStack?: string, context?: string): void => {
      track({
        category: 'error',
        action: 'boundary_triggered',
        properties: {
          error_name: error.name,
          error_message: error.message?.slice(0, 500),
          ...(componentStack && { component_stack: componentStack.slice(0, 500) }),
          ...(context && { context }),
        },
      });
    },
  },

  /**
   * Documentation events
   */
  docs: {
    /**
     * Track documentation search
     * @param query - Search query
     * @param resultsCount - Number of results returned
     */
    searchPerformed: (query: string, resultsCount: number): void => {
      track({
        category: 'docs',
        action: 'search_performed',
        properties: {
          query_length: query.length,
          query_preview: query.slice(0, 50),
          results_count: resultsCount,
        },
      });
    },

    /**
     * Track search result click
     * @param query - Original search query
     * @param resultPath - Path of clicked result
     * @param resultPosition - Position in results (1-indexed)
     */
    searchResultClicked: (query: string, resultPath: string, resultPosition: number): void => {
      track({
        category: 'docs',
        action: 'search_result_clicked',
        properties: {
          query_preview: query.slice(0, 50),
          result_path: resultPath,
          result_position: resultPosition,
        },
      });
    },
  },
};

export default analytics;
