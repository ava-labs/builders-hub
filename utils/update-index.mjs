import * as fs from 'node:fs';
import { sync } from 'trieve-fumadocs-adapter/search/sync';
import { TrieveSDK } from 'trieve-ts-sdk';

const content = fs.readFileSync('.next/server/app/static.json.body');

/** @type {import('trieve-fumadocs-adapter/search/sync').TrieveDocument[]} **/
const records = JSON.parse(content.toString());

const client = new TrieveSDK({
  apiKey: process.env.TRIEVE_API_KEY,
  datasetId: process.env.DATASET_ID,
});

sync(client, records); 