import { readFileSync } from 'node:fs';
import { parseProductUpsertedEvent } from '../src/infra/parse-product-upserted-event';

// Run from the repository root, like the other npm demonstrations.
const event: unknown = JSON.parse(readFileSync('samples/product-upserted.cloudevent.json', 'utf8'));
const parsed = parseProductUpsertedEvent(event);
if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
console.log('Validated event and subscriber-owned update:');
console.log(JSON.stringify(parsed.data, null, 2));
