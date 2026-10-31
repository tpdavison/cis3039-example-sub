import { readFileSync } from 'node:fs';
import { applyProductUpdate } from '../src/app/apply-product-update';
import { FakeProductProjectionRepo } from '../src/infra/fake-product-projection-repo';
import { parseProductUpsertedEvent } from '../src/infra/parse-product-upserted-event';

async function main(): Promise<void> {
  const original = JSON.parse(readFileSync('samples/product-upserted.cloudevent.json', 'utf8'));
  const renamed = {
    ...original,
    id: '550e8400-e29b-41d4-a716-446655440001',
    time: '2026-10-28T11:01:00.000Z',
    data: { ...original.data, name: 'Renamed headphones', updatedAt: '2026-10-28T11:01:00.000Z' },
  };
  const productProjectionRepo = new FakeProductProjectionRepo();
  for (const [label, event] of [
    ['First delivery', original],
    ['Same event redelivered', original],
    ['A second product operation', renamed],
    ['Older event delivered late', original],
  ] as const) {
    const parsed = parseProductUpsertedEvent(event);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
    const result = await applyProductUpdate({ productProjectionRepo }, parsed.data.update);
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    console.log(label, {
      eventId: parsed.data.eventId,
      stored: await productProjectionRepo.getById(result.data.productId),
    });
  }
  console.log('No deduplication or ordering policy ran; the late event restored the old name.');
  console.log('A new process starts with an empty fake projection. No Azure call was made.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Delivery demonstration failed.');
  process.exitCode = 1;
});
