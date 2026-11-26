/**
 * Whether a browser sent this request as a page load: a link, a redirect, a
 * `window.open` or a form post. A browser names that in `Sec-Fetch-Mode`, a
 * header that page script cannot set. An API route that changes state is
 * called by `fetch` from this site's pages, never by a page load, and a page
 * load is the one request that another site can make with the visitor's
 * session cookie (SameSite=Lax). A client that is not a browser sends no such
 * header and is not a page load.
 */
export function isNavigation(request: Request): boolean {
  return request.headers.get('sec-fetch-mode') === 'navigate';
}
