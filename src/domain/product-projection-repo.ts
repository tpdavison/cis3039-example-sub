import type { ProductProjection } from './product-projection';

/**
 * Storage port for the subscriber's product display projection.
 * Implementations reject promises on storage, authentication or network failures.
 * These operations provide no concurrency protection, deduplication or ordering.
 */
export interface ProductProjectionRepo {
  /** Fetch a projection by product id. Returns null if not found. */
  getById(productId: string): Promise<ProductProjection | null>;

  /** Create or replace a projection by product id. Returns the saved view. */
  save(projection: ProductProjection): Promise<ProductProjection>;
}
