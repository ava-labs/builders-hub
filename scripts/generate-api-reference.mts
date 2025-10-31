import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs'; 

async function generate() {
  // Ensure the public/openapi directory exists
  mkdirSync('./public/openapi', { recursive: true });

  // Fetch and save Glacier API spec
  // Note: We keep all parameters (including pageToken) in the spec.
  // Empty parameters are filtered out by the proxy (/api/openapi-proxy) at request time.
  console.log('📥 Fetching Glacier API spec...');
  const glacierResponse = await fetch('https://glacier-api.avax.network/api-json');
  const glacierSpec = await glacierResponse.json();
  writeFileSync('./public/openapi/glacier.json', JSON.stringify(glacierSpec, null, 2));
  console.log('✅ Saved Glacier API spec to public/openapi/glacier.json');

  // Fetch and save Popsicle API spec
  console.log('📥 Fetching Popsicle API spec...');
  const popsicleResponse = await fetch('https://popsicle-api.avax.network/api-json');
  const popsicleSpec = await popsicleResponse.json();
  writeFileSync('./public/openapi/popsicle.json', JSON.stringify(popsicleSpec, null, 2));
  console.log('✅ Saved Popsicle API spec to public/openapi/popsicle.json');
  
  // Set pageToken to empty string (instead of "string" placeholder)
  console.log('\n🔧 Setting pageToken to empty...');
  execSync('tsx scripts/set-pagetoken-empty.mts', { stdio: 'inherit' });
  
  // Remove deprecated endpoints BEFORE generating docs
  console.log('\n🔧 Removing deprecated endpoints...');
  execSync('tsx scripts/remove-deprecated-endpoints.mts', { stdio: 'inherit' });

  // Clean up old generated files to ensure deprecated endpoints are removed
  console.log('\n🧹 Cleaning up old generated files...');
  execSync('tsx scripts/cleanup-generated-files.mts', { stdio: 'inherit' });

  // Create OpenAPI instances using local files (after cleanup)
  const dataApi = createOpenAPI({
    input: ['./public/openapi/glacier.json'],
  });

  const metricsApi = createOpenAPI({
    input: ['./public/openapi/popsicle.json'],
  });

  const pChainApi = createOpenAPI({
    input: ['./public/openapi/platformvm.yaml'],
  });

  const cChainApi = createOpenAPI({
    input: ['./public/openapi/coreth.yaml'],
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

  // Generate P-Chain RPC API documentation
  await generateFiles({
    input: pChainApi,
    output: './content/docs/rpcs/p-chain',
    includeDescription: true,
    groupBy: 'tag', // Group endpoints by their OpenAPI tags
  });

  console.log('✅ Generated P-Chain RPC API documentation');

  // Generate C-Chain RPC API documentation
  await generateFiles({
    input: cChainApi,
    output: './content/docs/rpcs/c-chain',
    includeDescription: true,
    groupBy: 'tag', // Group endpoints by their OpenAPI tags
  });

  console.log('✅ Generated C-Chain RPC API documentation');
  
  // Move webhooks from data-api to webhook-api
  console.log('\n🔧 Moving webhooks to webhook-api...');
  execSync('tsx scripts/move-webhooks.mts', { stdio: 'inherit' });
  
  // Reorder Data API sections (move signature-aggregator to ICM Services)
  console.log('\n🔧 Reordering Data API sections...');
  execSync('tsx scripts/reorder-data-api-sections.mts', { stdio: 'inherit' });
  
  // Clean up empty sections from meta.json
  console.log('\n🔧 Cleaning up meta.json files...');
  execSync('tsx scripts/cleanup-empty-sections.mts', { stdio: 'inherit' });
  
  // Fix empty titles
  console.log('\n🔧 Fixing empty titles...');
  execSync('tsx scripts/fix-api-titles.mts', { stdio: 'inherit' });
}

void generate();