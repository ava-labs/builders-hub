import type { MetadataRoute } from "next";

/* Crawlers may read every page. They may not call the tx trace route
   (app/api/trace), which spends stats-api's trace slots. The tx
   pages stay crawlable, and the trace is client-side content, so search
   results do not change. There
   is no "Allow: /": everything is allowed by default, and a parser that
   reads the first match would read it as allowing these paths too.

   Baidu's renderer runs the explorer's client code on every page it crawls.
   Each crawled tx page then calls /api/evm, /api/explorer and /api/trace,
   which read stats-api. Baidu gets its own group, so that group must repeat
   the trace rule; "/api/" covers it. Baidu can still crawl every page. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: ["/api/trace/"] },
      { userAgent: ["Baiduspider", "Baiduspider-render"], disallow: ["/api/"] },
    ],
  };
}
