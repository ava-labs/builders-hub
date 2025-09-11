async function main() {
  const { generateFiles } = await import('fumadocs-openapi');
  const { createOpenAPI } = await import('fumadocs-openapi/server');
  
  const openapi = createOpenAPI({
    input: ['/data-api.yaml'],
  });

  await generateFiles({
    input: openapi,
    output: './content/docs/openapi',
    includeDescription: true,
  });
}

main().catch(console.error);