import { readFileSync, writeFileSync } from 'fs';

interface ApiSpec {
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

function cleanCodeExamples(filePath: string, apiName: string) {
  console.log(`\n🧹 Cleaning code examples for ${apiName}...`);
  
  const content = readFileSync(filePath, 'utf-8');
  const spec: ApiSpec = JSON.parse(content);
  
  let paramCount = 0;
  let schemaCount = 0;

  // Set empty examples for pageToken parameters so they don't appear in code snippets
  if (spec.paths) {
    for (const path in spec.paths) {
      for (const method in spec.paths[path]) {
        const operation = spec.paths[path][method];
        
        if (operation?.parameters) {
          for (const param of operation.parameters) {
            if (param.name === 'pageToken') {
              // Set example to undefined/null so it doesn't show in code examples
              param.example = undefined;
              delete param.example;
              // Also remove from schema if present
              if (param.schema) {
                param.schema.example = undefined;
                delete param.schema.example;
                param.schema.default = undefined;
                delete param.schema.default;
              }
              paramCount++;
            }
          }
        }
      }
    }
  }

  // Clean pageToken in request body schemas
  if (spec.components?.schemas) {
    for (const schemaName in spec.components.schemas) {
      const schema = spec.components.schemas[schemaName];
      if (schema.properties?.pageToken) {
        schema.properties.pageToken.example = undefined;
        delete schema.properties.pageToken.example;
        schema.properties.pageToken.default = undefined;
        delete schema.properties.pageToken.default;
        schemaCount++;
        console.log(`  📝 Cleaned pageToken in ${schemaName}`);
      }
    }
  }

  // Write the cleaned spec
  writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`  ✅ Cleaned ${paramCount} pageToken parameters`);
  if (schemaCount > 0) {
    console.log(`  ✅ Cleaned ${schemaCount} pageToken schema properties`);
  }
  
  return paramCount + schemaCount;
}

async function cleanAllCodeExamples() {
  console.log('🧹 Cleaning code examples from OpenAPI specs...');

  const glacierCleaned = cleanCodeExamples(
    'public/openapi/glacier.json',
    'Glacier Data API'
  );

  const popsicleCleaned = cleanCodeExamples(
    'public/openapi/popsicle.json',
    'Popsicle Metrics API'
  );

  const totalCleaned = glacierCleaned + popsicleCleaned;
  console.log(`\n🎉 Cleaned ${totalCleaned} pageToken examples in total!`);
}

cleanAllCodeExamples();

