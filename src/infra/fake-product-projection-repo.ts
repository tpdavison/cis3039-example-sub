import type { ProductProjection } from '../domain/product-projection';
import type { ProductProjectionRepo } from '../domain/product-projection-repo';

// Both fields are strings, so copying them isolates stored and returned views.
const cloneProjection = (
  projection: ProductProjection,
): ProductProjection => ({
  productId: projection.productId,
  displayName: projection.displayName,
});

/**
 * Fake in-memory storage for the subscriber's projection.
 * State is lost on restart and is not shared across processes or instances.
 * Provides no concurrency protection, deduplication or ordering policy.
 * A late update can replace a newer display name.
 */
export class FakeProductProjectionRepo implements ProductProjectionRepo {
  private readonly store = new Map<string, ProductProjection>();

  constructor(initial: readonly ProductProjection[] = []) {
    for (const projection of initial) {
      this.store.set(projection.productId, cloneProjection(projection));
    }
  }

  async getById(productId: string): Promise<ProductProjection | null> {
    const found = this.store.get(productId);
    return found ? cloneProjection(found) : null;
  }

  async save(projection: ProductProjection): Promise<ProductProjection> {
    const toStore = cloneProjection(projection);
    this.store.set(toStore.productId, toStore);
    return cloneProjection(toStore);
  }
}
