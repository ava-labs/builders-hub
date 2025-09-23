async function main() {
  const { generateFiles } = await import('fumadocs-openapi');
  const { createOpenAPI } = await import('fumadocs-openapi/server');
  
  const openapi = createOpenAPI({
    input: ['./constants/data-api.yaml'],
  });

  await generateFiles({
    input: openapi,
    output: './content/api-reference',
    includeDescription: true,
  });
}

main().catch(console.error);