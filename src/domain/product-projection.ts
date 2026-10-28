/**
 * A subscriber-owned view for displaying a product name.
 * This is not the publisher's Product model or the incoming event contract.
 */
export type ProductProjection = {
  readonly productId: string;
  readonly displayName: string;
};

export type CreateProductProjectionParams = ProductProjection;

export type ProductProjectionValidationIssue = {
  readonly field: keyof CreateProductProjectionParams;
  readonly message: string;
};

export type CreateProductProjectionResult =
  | { readonly success: true; readonly data: ProductProjection }
  | {
      readonly success: false;
      readonly issues: readonly ProductProjectionValidationIssue[];
    };

/** Incoming events must be validated and mapped before constructing this view. */
export function createProductProjection(
  params: CreateProductProjectionParams,
): CreateProductProjectionResult {
  const issues: ProductProjectionValidationIssue[] = [];

  if (
    typeof params.productId !== 'string' ||
    params.productId.trim() === ''
  ) {
    issues.push({
      field: 'productId',
      message: 'Product id must be a non-empty string.',
    });
  }
  if (
    typeof params.displayName !== 'string' ||
    params.displayName.trim() === ''
  ) {
    issues.push({
      field: 'displayName',
      message: 'Display name must be a non-empty string.',
    });
  }
  if (issues.length > 0) return { success: false, issues };

  return {
    success: true,
    data: {
      productId: params.productId,
      displayName: params.displayName,
    },
  };
}
