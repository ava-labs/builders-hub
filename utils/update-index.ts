import { algoliasearch } from "algoliasearch";
import { sync, DocumentRecord } from "../node_modules/fumadocs-core/dist/search/algolia.js";
import * as fs from "node:fs";
import "dotenv/config";

async function main() {
  const filePath = {
    next: ".next/server/app/static.json.body",
    "tanstack-start": ".output/public/static.json",
    "react-router": "build/client/static.json",
    waku: "dist/public/static.json",
  }["next"];

  if (!process.env.ALGOLIA_WRITE_KEY) {
    console.log("ALGOLIA_WRITE_KEY is not set, skipping index update");
    return;
  }

  try {
    const content = fs.readFileSync(filePath);
    const records = JSON.parse(content.toString()) as DocumentRecord[];
    const client = algoliasearch("0T4ZBDJ3AF", process.env.ALGOLIA_WRITE_KEY);

    await sync(client, {
      documents: records,
      indexName: "builder-hub",
    });
  } catch (error) {
    console.error("Algolia sync failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Script execution failed:", error);
  if (process.env.VERCEL_ENV === "production") {
    process.exit(1);
  }
});
