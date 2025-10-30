import { readFileSync, writeFileSync } from 'fs';

interface ApiSpec {
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

function setPageTokenEmpty(filePath: string, apiName: string) {
  console.log(`\n🔧 Setting pageToken to empty for ${apiName}...`);
  
  const content = readFileSync(filePath, 'utf-8');
  const spec: ApiSpec = JSON.parse(content);
  
  let paramCount = 0;
  let schemaCount = 0;

  // Set pageToken parameters to have empty string as example/default
  if (spec.paths) {
    for (const path in spec.paths) {
      for (const method in spec.paths[path]) {
        const operation = spec.paths[path][method];
        
        if (operation?.parameters) {
          for (const param of operation.parameters) {
            if (param.name === 'pageToken') {
              // Set example to empty string
              param.example = '';
              // Also set in schema if present
              if (param.schema) {
                param.schema.example = '';
                param.schema.default = '';
              }
              paramCount++;
            }
          }
        }
      }
    }
  }

  // Set pageToken in request body schemas to empty
  if (spec.components?.schemas) {
    for (const schemaName in spec.components.schemas) {
      const schema = spec.components.schemas[schemaName];
      if (schema.properties?.pageToken) {
        schema.properties.pageToken.example = '';
        schema.properties.pageToken.default = '';
        schemaCount++;
        console.log(`  📝 Set empty pageToken in ${schemaName}`);
      }
    }
  }

  // Write the cleaned spec
  writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`  ✅ Set ${paramCount} pageToken parameters to empty`);
  if (schemaCount > 0) {
    console.log(`  ✅ Set ${schemaCount} pageToken schema properties to empty`);
  }
  
  return paramCount + schemaCount;
}

async function setAllPageTokensEmpty() {
  console.log('🔧 Setting pageToken values to empty...');

  const glacierSet = setPageTokenEmpty(
    'public/openapi/glacier.json',
    'Glacier Data API'
  );

  const popsicleSet = setPageTokenEmpty(
    'public/openapi/popsicle.json',
    'Popsicle Metrics API'
  );

  const totalSet = glacierSet + popsicleSet;
  console.log(`\n🎉 Set ${totalSet} pageToken values to empty in total!`);
}

setAllPageTokensEmpty();

