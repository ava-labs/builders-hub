import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

interface ApiSpec {
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

async function downloadAndCleanSpec(url: string, outputPath: string, apiName: string) {
  console.log(`\n📥 Downloading ${apiName} spec from ${url}...`);
  
  const response = await fetch(url);
  const spec: ApiSpec = await response.json();
  
  let paginationCount = 0;
  let pageTokenParamsCount = 0;
  let pageTokenPropsCount = 0;

  // Remove x-speakeasy-pagination from all endpoints and fix pageToken parameters
  if (spec.paths) {
    for (const path in spec.paths) {
      for (const method in spec.paths[path]) {
        const operation = spec.paths[path][method];
        
        // Remove x-speakeasy-pagination
        if (operation && operation['x-speakeasy-pagination']) {
          delete operation['x-speakeasy-pagination'];
          paginationCount++;
        }
        
        // Remove pageToken parameters entirely
        if (operation?.parameters) {
          const originalLength = operation.parameters.length;
          operation.parameters = operation.parameters.filter((param: any) => param.name !== 'pageToken');
          const removedCount = originalLength - operation.parameters.length;
          pageTokenParamsCount += removedCount;
        }
      }
    }
  }

  // Remove pageToken from request body schemas entirely
  if (spec.components?.schemas) {
    for (const schemaName in spec.components.schemas) {
      const schema = spec.components.schemas[schemaName];
      if (schema.properties?.pageToken) {
        delete schema.properties.pageToken;
        // Also remove from required array if present
        if (schema.required && Array.isArray(schema.required)) {
          schema.required = schema.required.filter((prop: string) => prop !== 'pageToken');
        }
        pageTokenPropsCount++;
        console.log(`  📝 Removed pageToken from ${schemaName}`);
      }
    }
  }

  // Ensure the output directory exists
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write the cleaned spec
  writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`  ✅ Removed ${paginationCount} pagination configs`);
  console.log(`  ✅ Removed ${pageTokenParamsCount} pageToken parameters`);
  if (pageTokenPropsCount > 0) {
    console.log(`  ✅ Removed ${pageTokenPropsCount} pageToken schema properties`);
  }
  console.log(`  💾 Saved to ${outputPath}`);
  
  return { paginationCount, pageTokenParamsCount, pageTokenPropsCount };
}

function updateMdxFiles(directory: string, oldUrl: string, newUrl: string) {
  const files = getAllMdxFiles(directory);
  let updatedCount = 0;

  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    
    if (content.includes(oldUrl)) {
      content = content.replace(new RegExp(oldUrl, 'g'), newUrl);
      writeFileSync(file, content, 'utf-8');
      updatedCount++;
    }
  }

  return updatedCount;
}

function getAllMdxFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentPath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.mdx')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

async function cleanupPageTokens() {
  console.log('🧹 Cleaning up pageToken parameters in API playground...\n');

  // Download and clean Glacier Data API
  await downloadAndCleanSpec(
    'https://glacier-api.avax.network/api-json',
    'public/openapi/glacier.json',
    'Glacier Data API'
  );

  // Download and clean Popsicle Metrics API
  await downloadAndCleanSpec(
    'https://popsicle-api.avax.network/api-json',
    'public/openapi/popsicle.json',
    'Popsicle Metrics API'
  );

  // Update MDX files to use local cleaned specs
  console.log('\n📝 Updating MDX files to use local cleaned specs...');
  
  const dataApiUpdates = updateMdxFiles(
    'content/docs/api-reference/data-api',
    'https://glacier-api.avax.network/api-json',
    '/openapi/glacier.json'
  );
  console.log(`  ✅ Updated ${dataApiUpdates} Data API files`);

  const metricsApiUpdates = updateMdxFiles(
    'content/docs/api-reference/metrics-api',
    'https://popsicle-api.avax.network/api-json',
    '/openapi/popsicle.json'
  );
  console.log(`  ✅ Updated ${metricsApiUpdates} Metrics API files`);

  console.log('\n🎉 All pageToken parameters cleaned successfully!');
}

cleanupPageTokens();

