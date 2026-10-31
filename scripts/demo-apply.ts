import { applyProductUpdate } from '../src/app/apply-product-update';
import { FakeProductProjectionRepo } from '../src/infra/fake-product-projection-repo';

async function main(): Promise<void> {
  const productProjectionRepo = new FakeProductProjectionRepo();
  const deps = { productProjectionRepo };
  const productId = 'demo-product-1';
  console.log('Before update:', await productProjectionRepo.getById(productId));

  const result = await applyProductUpdate(deps, {
    productId,
    displayName: 'Wireless headphones',
  });
  if (!result.success) throw new Error('The demonstration update was invalid.');
  console.log('Application outcome:', result);
  console.log('Stored projection:', await productProjectionRepo.getById(productId));

  await applyProductUpdate(deps, { productId, displayName: 'Renamed headphones' });
  console.log('After replacement:', await productProjectionRepo.getById(productId));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Apply demonstration failed.');
  process.exitCode = 1;
});
