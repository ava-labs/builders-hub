export function withQuickL1WafToken(url: string): string {
  const token = process.env.QUICK_L1_WAF_BYPASS_TOKEN;
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}
