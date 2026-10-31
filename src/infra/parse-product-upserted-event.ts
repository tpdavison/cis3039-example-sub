import type { ApplyProductUpdateCommand } from '../app/apply-product-update';

export type ProductUpdateNotification = {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly productUpdatedAt: Date;
  readonly update: ApplyProductUpdateCommand;
};

export type EventIssue = { readonly field: string; readonly message: string };
export type ParseProductUpsertedResult =
  | { readonly success: true; readonly data: ProductUpdateNotification }
  | { readonly success: false; readonly issues: readonly EventIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Parse the example's ISO-style timestamps; this is not exhaustive RFC 3339 validation. */
function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const hasDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i.test(value);
  const hasTimezone = /(Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!hasDateTime || !hasTimezone) return null;

  // Date handles UTC/offset conversion. Keep clock hours in the usual 00–23 range.
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()) || Number(value.slice(11, 13)) > 23) return null;

  // Date can normalise 30 February into March. Round-trip the written date to reject it.
  const datePart = value.slice(0, 10);
  const calendarDate = new Date(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== datePart) return null;
  return instant;
}

/** The Azure boundary owns the wire contract; the application owns its small view. */
export function parseProductUpsertedEvent(event: unknown): ParseProductUpsertedResult {
  if (!isRecord(event)) {
    return { success: false, issues: [{ field: 'event', message: 'Expected a CloudEvent object.' }] };
  }
  const issues: EventIssue[] = [];
  const expected = {
    specversion: '1.0',
    source: '/services/catalogue',
    type: 'catalogue.product.upserted',
    datacontenttype: 'application/json',
  };
  for (const [field, value] of Object.entries(expected)) {
    if (event[field] !== value) issues.push({ field, message: `Expected ${value}.` });
  }
  if (!isNonEmptyString(event.id)) {
    issues.push({ field: 'id', message: 'Expected a non-empty event id.' });
  }
  const occurredAt = parseTimestamp(event.time);
  if (!occurredAt) issues.push({ field: 'time', message: 'Expected a valid timestamp with timezone.' });
  if (!isRecord(event.data)) {
    return { success: false, issues: [...issues, { field: 'data', message: 'Expected a product snapshot object.' }] };
  }
  const data = event.data;
  for (const field of ['productId', 'name', 'description'] as const) {
    if (!isNonEmptyString(data[field])) {
      issues.push({ field: `data.${field}`, message: 'Expected a non-empty string.' });
    }
  }
  if (typeof data.pricePence !== 'number' || !Number.isSafeInteger(data.pricePence) || data.pricePence < 0) {
    issues.push({ field: 'data.pricePence', message: 'Expected a non-negative safe integer.' });
  }
  if (event.subject !== `products/${data.productId}`) {
    issues.push({ field: 'subject', message: 'Expected products/{data.productId}.' });
  }
  const productUpdatedAt = parseTimestamp(data.updatedAt);
  if (!productUpdatedAt) {
    issues.push({ field: 'data.updatedAt', message: 'Expected a valid timestamp with timezone.' });
  }
  // These guards narrow unknown values only after the runtime checks above.
  if (issues.length > 0 || !isNonEmptyString(event.id) || !occurredAt ||
      !productUpdatedAt || !isNonEmptyString(data.productId) || !isNonEmptyString(data.name)) {
    return { success: false, issues };
  }
  return { success: true, data: {
    eventId: event.id,
    occurredAt,
    productUpdatedAt,
    update: { productId: data.productId, displayName: data.name },
  } };
}
