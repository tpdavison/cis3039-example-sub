import type { ApplyProductUpdateDeps } from '../app/apply-product-update';
import type { ProductProjectionRepo } from '../domain/product-projection-repo';
import { FakeProductProjectionRepo } from '../infra/fake-product-projection-repo';

let cachedProductProjectionRepo: ProductProjectionRepo | null = null;

// Reuse one fake per worker process so successive invocations can observe it.
// This is neither durable storage nor state shared across scaled-out workers.
export const getProductProjectionRepo = (): ProductProjectionRepo => {
  if (!cachedProductProjectionRepo) {
    cachedProductProjectionRepo = new FakeProductProjectionRepo();
  }
  return cachedProductProjectionRepo;
};

export const createApplyProductUpdateDeps = (): ApplyProductUpdateDeps => ({
  productProjectionRepo: getProductProjectionRepo(),
});
