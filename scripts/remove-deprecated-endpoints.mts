import { readFileSync, writeFileSync } from 'fs';

interface ApiSpec {
  paths?: Record<string, Record<string, any>>;
}

function removeDeprecatedEndpoints(filePath: string, apiName: string) {
  console.log(`\n🗑️  Removing deprecated endpoints from ${apiName}...`);
  
  const content = readFileSync(filePath, 'utf-8');
  const spec: ApiSpec = JSON.parse(content);
  
  let removedEndpointsCount = 0;
  const removedEndpoints: string[] = [];

  if (spec.paths) {
    // Iterate through all paths
    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      const methodsToRemove: string[] = [];
      
      // Check each HTTP method in this path
      for (const method in pathItem) {
        const operation = pathItem[method];
        
        // Check if the operation is deprecated
        if (operation && operation.deprecated === true) {
          methodsToRemove.push(method);
          removedEndpoints.push(`${method.toUpperCase()} ${path}`);
          removedEndpointsCount++;
        }
      }
      
      // Remove deprecated methods
      for (const method of methodsToRemove) {
        delete pathItem[method];
      }
      
      // If all methods are removed from this path, remove the entire path
      const remainingMethods = Object.keys(pathItem).filter(
        key => !['parameters', 'servers', 'summary', 'description'].includes(key)
      );
      
      if (remainingMethods.length === 0) {
        delete spec.paths[path];
      }
    }
  }

  // Write the cleaned spec back
  writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');
  
  console.log(`  ✅ Removed ${removedEndpointsCount} deprecated endpoints`);
  
  if (removedEndpoints.length > 0) {
    console.log(`\n  Removed endpoints:`);
    removedEndpoints.forEach(endpoint => {
      console.log(`    - ${endpoint}`);
    });
  }
  
  return removedEndpointsCount;
}

async function cleanupDeprecatedEndpoints() {
  console.log('🧹 Cleaning up deprecated endpoints...');

  // Remove deprecated endpoints from Glacier Data API
  const glacierRemoved = removeDeprecatedEndpoints(
    'public/openapi/glacier.json',
    'Glacier Data API'
  );

  // Remove deprecated endpoints from Popsicle Metrics API
  const popsicleRemoved = removeDeprecatedEndpoints(
    'public/openapi/popsicle.json',
    'Popsicle Metrics API'
  );

  const totalRemoved = glacierRemoved + popsicleRemoved;
  console.log(`\n🎉 Removed ${totalRemoved} deprecated endpoints in total!`);
}

cleanupDeprecatedEndpoints();

