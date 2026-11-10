/* Crawlers, by user agent. Each pattern names a crawler or a link previewer
   by its own bot token, never a brand alone: a person in the Sogou or Yandex
   browser, or in an app's in-app browser, must not match. A scraper that
   sends a browser's agent passes; the routes that need it hold those with
   budgets. An empty agent passes too, since no crawler we know sends none. */

const BOTS = new RegExp(
  [
    "Googlebot",
    "GoogleOther",
    "Google-InspectionTool",
    "Google-Extended",
    "Storebot-Google",
    "AdsBot-Google",
    "Mediapartners-Google",
    "APIs-Google",
    "bingbot",
    "BingPreview",
    "adidxbot",
    "Slurp",
    "DuckDuckBot",
    "Baiduspider",
    "YandexBot",
    "YandexRenderResourcesBot",
    "Sogou[ \\w]*spider",
    "Bytespider",
    "PetalBot",
    "Applebot",
    "facebookexternalhit",
    "facebookcatalog",
    "meta-externalagent",
    "Twitterbot",
    "LinkedInBot",
    "Slackbot",
    "Discordbot",
    "TelegramBot",
    "WhatsApp/",
    "redditbot",
    "ia_archiver",
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "CCBot",
    "Amazonbot",
    "AhrefsBot",
    "SemrushBot",
    "MJ12bot",
    "DotBot",
    "YouBot",
    "Querit",
  ].join("|"),
  "i",
);

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOTS.test(userAgent);
}
