import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { execSync } from 'child_process';

async function generate() {
  // Create OpenAPI instances directly in this script
  const dataApi = createOpenAPI({
    input: ['https://glacier-api.avax.network/api-json'],
  });

  const metricsApi = createOpenAPI({
    input: ['https://popsicle-api.avax.network/api-json'],
  });

  // Generate Data API documentation
  await generateFiles({
    input: dataApi,
    output: './content/docs/api-reference/data-api',
    includeDescription: true,
    groupBy: 'tag', // Group endpoints by their OpenAPI tags
  });

  console.log('✅ Generated Data API documentation');

  // Generate Metrics API documentation
  await generateFiles({
    input: metricsApi,
    output: './content/docs/api-reference/metrics-api',
    includeDescription: true,
    groupBy: 'tag', // Group endpoints by their OpenAPI tags
  });

  console.log('✅ Generated Metrics API documentation');
  
  // Fix empty titles
  console.log('\n🔧 Fixing empty titles...');
  execSync('tsx scripts/fix-api-titles.mts', { stdio: 'inherit' });
}

void generate();