import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { getAuthSession } from './auth/authSession';
import { Permission, actionFromMethod } from './auth/rolePermissions';
import { hasPermission, hasAnyRole } from './auth/roles';
import type { Resource } from './auth/rolePermissions';

/**
 * Helper type for route handlers with params.
 * Usage: withAuth<RouteParams<{ id: string }>>(...)
 */
export type RouteParams<T extends Record<string, string>> = {
  params: Promise<T>;
};

type Handler<TContext = unknown> = (
  request: NextRequest,
  context: TContext,
  session: Session,
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// withAuth — requires any active session
// ---------------------------------------------------------------------------

export function withAuth<TContext = unknown>(
  handler: Handler<TContext>,
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required. Please log in to access this resource.' },
        { status: 401 },
      );
    }
    return handler(request, context, session);
  };
}

// ---------------------------------------------------------------------------
// withAuthRole — requires one of the listed roles (backward compat)
// ---------------------------------------------------------------------------

export function withAuthRole<TContext = unknown>(
  role: string | string[],
  handler: Handler<TContext>,
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required. Please log in to access this resource.' },
        { status: 401 },
      );
    }

    const roles = Array.isArray(role) ? role : [role];
    const attrs = session.user.custom_attributes ?? [];
    if (!hasAnyRole(attrs, roles)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied.' },
        { status: 403 },
      );
    }

    return handler(request, context, session);
  };
}

// ---------------------------------------------------------------------------
// withAuthPermission — requires an explicit { resource, action } permission
// ---------------------------------------------------------------------------

/**
 * Protects a handler with an explicit permission check.
 * Use this for edge cases where the HTTP method does not represent the action
 * (e.g. a POST that is semantically a read, or ownership checks).
 *
 * @example
 * export const POST = withAuthPermission(
 *   { resource: "badge", action: "write" },
 *   async (req, ctx, session) => { ... }
 * );
 */
export function withAuthPermission<TContext = unknown>(
  required: Permission,
  handler: Handler<TContext>,
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required.' },
        { status: 401 },
      );
    }

    const attrs = session.user.custom_attributes ?? [];
    if (!hasPermission(attrs, required)) {
      return NextResponse.json(
        { error: 'Forbidden', required: `${required.resource}:${required.action}` },
        { status: 403 },
      );
    }

    return handler(request, context, session);
  };
}

// ---------------------------------------------------------------------------
// withAuthResource — infers action from HTTP method
// ---------------------------------------------------------------------------

/**
 * Protects a handler by declaring only the resource.
 * The action is inferred from the HTTP method (GET→read, POST→write, DELETE→delete).
 *
 * This is the preferred guard for standard REST endpoints.
 *
 * @example
 * export const GET    = withAuthResource("badge", async (req, ctx, session) => { ... }); // badge:read
 * export const POST   = withAuthResource("badge", async (req, ctx, session) => { ... }); // badge:write
 * export const DELETE = withAuthResource("badge", async (req, ctx, session) => { ... }); // badge:delete
 */
export function withAuthResource<TContext = unknown>(
  resource: Resource,
  handler: Handler<TContext>,
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required.' },
        { status: 401 },
      );
    }

    const action = actionFromMethod(request.method);
    const attrs = session.user.custom_attributes ?? [];

    if (!hasPermission(attrs, { resource, action })) {
      return NextResponse.json(
        { error: 'Forbidden', required: `${resource}:${action}` },
        { status: 403 },
      );
    }

    return handler(request, context, session);
  };
}
