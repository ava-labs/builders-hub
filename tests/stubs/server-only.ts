/*
 * `server-only` exists to make a build fail when server code is imported
 * into a client bundle. Under Vitest there is no client bundle and the
 * package resolves only through Next's build conditions, so tests alias
 * it here. The guard still does its job everywhere it matters.
 */
export {};
