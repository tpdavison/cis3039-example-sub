import { createProductProjection } from '../src/domain/product-projection';

const valid = createProductProjection({
  productId: 'demo-product-1',
  displayName: 'Wireless headphones',
});

if (!valid.success) {
  throw new Error('The valid projection demonstration unexpectedly failed.');
}
console.log('Valid subscriber product projection:');
console.log(JSON.stringify(valid.data, null, 2));

const invalid = createProductProjection({
  productId: ' ',
  displayName: '',
});

if (invalid.success) {
  throw new Error('The invalid projection demonstration unexpectedly succeeded.');
}
console.log('\nInvalid projection issues:');
for (const issue of invalid.issues) {
  console.log(`- ${issue.field}: ${issue.message}`);
}
