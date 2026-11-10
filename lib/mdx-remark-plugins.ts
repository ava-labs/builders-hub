import remarkMath from 'remark-math';

// The remark plugins that source.config.ts adds to the fumadocs preset of every MDX
// collection. lib/search/structured-data.ts runs the same remark stage for the search
// index, so a plugin added here reaches both.
export const remarkPlugins = [remarkMath];
