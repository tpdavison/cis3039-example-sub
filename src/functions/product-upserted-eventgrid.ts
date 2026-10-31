import { app } from '@azure/functions';
import type { InvocationContext } from '@azure/functions';
import { applyProductUpdate } from '../app/apply-product-update';
import { createApplyProductUpdateDeps } from '../config/composition-root';
import { parseProductUpsertedEvent } from '../infra/parse-product-upserted-event';

export async function productUpsertedEventGrid(
  event: unknown,
  context: InvocationContext,
): Promise<void> {
  const parsed = parseProductUpsertedEvent(event);
  if (!parsed.success) {
    // Report field issues without logging an arbitrary, potentially sensitive payload.
    context.error('Product event rejected', { issues: parsed.issues });
    throw new Error('Invalid product upserted CloudEvent');
  }
  const notification = parsed.data;
  const correlation = {
    eventId: notification.eventId,
    productId: notification.update.productId,
  };
  context.log('Product event received', {
    ...correlation,
    occurredAt: notification.occurredAt.toISOString(),
    productUpdatedAt: notification.productUpdatedAt.toISOString(),
  });

  try {
    const result = await applyProductUpdate(createApplyProductUpdateDeps(), notification.update);
    if (!result.success) {
      throw new Error('Mapped product projection was invalid');
    }
    // Log only after the awaited save. Receipt and an application effect are separate.
    context.log('Product projection applied', { ...correlation, projection: result.data });
  } catch {
    context.error('Product projection failed', correlation);
    // A failed invocation must remain visible to the host and delivery service.
    throw new Error('Product projection update failed');
  }
}

app.eventGrid('productUpsertedEventGrid', {
  handler: productUpsertedEventGrid,
});
