import { createProductProjection } from '../domain/product-projection';
import type {
  ProductProjection,
  ProductProjectionValidationIssue,
} from '../domain/product-projection';
import type { ProductProjectionRepo } from '../domain/product-projection-repo';

export type ApplyProductUpdateCommand = {
  readonly productId: string;
  readonly displayName: string;
};

export type ApplyProductUpdateDeps = {
  readonly productProjectionRepo: ProductProjectionRepo;
};

export type ApplyProductUpdateResult =
  | { readonly success: true; readonly data: ProductProjection }
  | {
      readonly success: false;
      readonly issues: readonly ProductProjectionValidationIssue[];
    };

/** Replace this subscriber's view. No event transport or publisher model is needed. */
export async function applyProductUpdate(
  deps: ApplyProductUpdateDeps,
  command: ApplyProductUpdateCommand,
): Promise<ApplyProductUpdateResult> {
  const creation = createProductProjection(command);
  if (!creation.success) return creation;

  // Storage failures propagate to the inbound adapter; they are not bad input.
  // Applying a snapshot supplies no deduplication or ordering policy.
  const saved = await deps.productProjectionRepo.save(creation.data);
  return { success: true, data: saved };
}
