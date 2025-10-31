import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'; 

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

  // Note: Do not delete existing content; we preserve root files by restoring after generation

  // Create OpenAPI instances using local files (after prep)
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

  // Generate Data API documentation (preserve root files)
  const dataOut = './content/docs/api-reference/data-api';
  const dataMetaPath = `${dataOut}/meta.json`;
  const dataIndexPath = `${dataOut}/index.mdx`;
  const dataMetaBackup = existsSync(dataMetaPath) ? readFileSync(dataMetaPath, 'utf-8') : undefined;
  const dataIndexBackup = existsSync(dataIndexPath) ? readFileSync(dataIndexPath, 'utf-8') : undefined;
  await generateFiles({ input: dataApi, output: dataOut, includeDescription: true, groupBy: 'tag' });
  if (dataMetaBackup !== undefined) writeFileSync(dataMetaPath, dataMetaBackup);
  if (dataIndexBackup !== undefined) writeFileSync(dataIndexPath, dataIndexBackup);

  console.log('✅ Generated Data API documentation');

  // Generate Metrics API documentation (preserve root files)
  const metricsOut = './content/docs/api-reference/metrics-api';
  const metricsMetaPath = `${metricsOut}/meta.json`;
  const metricsIndexPath = `${metricsOut}/index.mdx`;
  const metricsMetaBackup = existsSync(metricsMetaPath) ? readFileSync(metricsMetaPath, 'utf-8') : undefined;
  const metricsIndexBackup = existsSync(metricsIndexPath) ? readFileSync(metricsIndexPath, 'utf-8') : undefined;
  await generateFiles({ input: metricsApi, output: metricsOut, includeDescription: true, groupBy: 'tag' });
  if (metricsMetaBackup !== undefined) writeFileSync(metricsMetaPath, metricsMetaBackup);
  if (metricsIndexBackup !== undefined) writeFileSync(metricsIndexPath, metricsIndexBackup);

  console.log('✅ Generated Metrics API documentation');

  // Generate P-Chain RPC API documentation (preserve root files)
  const pOut = './content/docs/rpcs/p-chain';
  const pMeta = `${pOut}/meta.json`;
  const pIndex = `${pOut}/index.mdx`;
  const pMetaBackup = existsSync(pMeta) ? readFileSync(pMeta, 'utf-8') : undefined;
  const pIndexBackup = existsSync(pIndex) ? readFileSync(pIndex, 'utf-8') : undefined;
  await generateFiles({ input: pChainApi, output: pOut, includeDescription: true, groupBy: 'tag' });
  if (pMetaBackup !== undefined) writeFileSync(pMeta, pMetaBackup);
  if (pIndexBackup !== undefined) writeFileSync(pIndex, pIndexBackup);

  console.log('✅ Generated P-Chain RPC API documentation');

  // Generate C-Chain RPC API documentation (preserve root files)
  const cOut = './content/docs/rpcs/c-chain';
  const cMeta = `${cOut}/meta.json`;
  const cIndex = `${cOut}/index.mdx`;
  const cMetaBackup = existsSync(cMeta) ? readFileSync(cMeta, 'utf-8') : undefined;
  const cIndexBackup = existsSync(cIndex) ? readFileSync(cIndex, 'utf-8') : undefined;
  await generateFiles({ input: cChainApi, output: cOut, includeDescription: true, groupBy: 'tag' });
  if (cMetaBackup !== undefined) writeFileSync(cMeta, cMetaBackup);
  if (cIndexBackup !== undefined) writeFileSync(cIndex, cIndexBackup);

  console.log('✅ Generated C-Chain RPC API documentation');
  
  // Move webhooks from data-api to webhook-api
  console.log('\n🔧 Moving webhooks to webhook-api...');
  execSync('tsx scripts/move-webhooks.mts', { stdio: 'inherit' });
  
  // Reorder Data API sections (move signature-aggregator to ICM Services)
  console.log('\n🔧 Reordering Data API sections...');
  execSync('tsx scripts/reorder-data-api-sections.mts', { stdio: 'inherit' });
  
  // Done
  
  // Fix empty titles
  console.log('\n🔧 Fixing empty titles...');
  execSync('tsx scripts/fix-api-titles.mts', { stdio: 'inherit' });
}

void generate();