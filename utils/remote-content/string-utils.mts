// Heuristic splitter for slugs like "addressdetails" → "Address Details"
export function smartSplitSlugToTitle(slugRaw: string): string {
  const slug = slugRaw.toLowerCase();
  const tokens = [
    'responsebody','transactions','transaction','delegations','delegation','validators','validator','delegators','delegator',
    'addresses','address','blockchains','blockchain','subnetworks','subnetwork','networks','network',
    'balances','balance','requests','request','responses','response','details','metadata','message','messages',
    'contracts','contract','transfers','transfer','components','component','options','option','metrics','status',
    'errors','error','amount','amounts','chains','chain','blocks','block','tokens','token','owners','owner',
    'ids','id','dto','type','types','value','values','global','globals','list','get','set',
    // Expanded vocabulary for better splitting
    'add','create','update','delete','remove','reindex',
    'webhook','webhooks','signature','signatures','key','keys','user','users','account','accounts',
    'fee','fees','gas','price','prices','limit','limits','offset','offsets','page','pages','size','sizes',
    'sort','order','to','from','by','for','with',
    // Second expansion based on more examples
    'over','time','latest','all','vertex','height','active','primary','staking', "deployment", "evm", "metrics", "validation",
    // Third expansion from more examples
    "erc1155", "erc721", "erc20", "erc20token", "erc721token", "erc1155token", "nft", "collectible", "contract", "deployments", "info",
    "icm", "ictt", "avax", "avalanche", "faucet", "fuji", "validator", "node", "deploy", "create", "tutorial", "guide", "error", "bridge",
    'btcb', 'bridged', 'aggregated', 'usage', 'rolling', 'window', 'subnet', "xchain", "pchain", "cchain", "native",
    // Final additions based on more examples
    'pending', 'rewards', 'teleporter'
  ];
  const words: string[] = [];
  let rest = slug;
  // Greedy split from end by known tokens
  while (rest.length > 0) {
    let matched = false;
    for (const t of tokens) {
      if (rest.endsWith(t) && rest.length > t.length) {
        const prefix = rest.slice(0, rest.length - t.length);
        rest = prefix;
        words.unshift(t);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // No token matched; take the remaining as one word
      words.unshift(rest);
      break;
    }
  }
  // Capitalize and apply acronym fixes
  const acronymFix = (w: string) => {
    const map: Record<string,string> = {
      'erc20':'ERC20','erc721':'ERC721','l1':'L1','icm':'ICM','evm':'EVM','rpc':'RPC','dto':'DTO','id':'ID','api':'API'
    };
    return map[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1);
  };
  const cleaned = words.filter(Boolean).map(acronymFix);
  return cleaned.join(' ');
}
