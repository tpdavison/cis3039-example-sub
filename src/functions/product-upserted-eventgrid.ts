import { app } from '@azure/functions';
import type { InvocationContext } from '@azure/functions';

export async function productUpsertedEventGrid(
  event: unknown,
  context: InvocationContext,
): Promise<void> {
  // Initial checkpoint: trigger receipt alone does not establish an application effect.
  context.log('Event Grid function received event:', JSON.stringify(event));
}

app.eventGrid('productUpsertedEventGrid', {
  handler: productUpsertedEventGrid,
});
