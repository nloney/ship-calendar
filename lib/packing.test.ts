import assert from 'node:assert/strict';
import { defaultPacking, normalizePacking, packingSummary, OTHER } from './packing';

const d = defaultPacking();
assert.equal(d.swag.length, 10);
assert.ok(d.swag.every(s => s.include), 'swag defaults to included');
assert.deepEqual(d.swag.find(s => s.name === 'Tote Bags'), { name: 'Tote Bags', count: '35', include: true });
assert.equal(normalizePacking({ booth: 'Hardware Pelican' }).swag.length, 10);
assert.deepEqual(packingSummary({}), []);
const s = packingSummary({ ...d, booth: OTHER, booth_other: 'Tabletop', banners: ['LE Big'], card: 'Jamel', docs: 'Order form' });
assert.ok(s.includes('Booth: Tabletop') && s.includes('Banners: LE Big') && s.includes('Cards: Jamel (50)') && s.includes('Folder docs: Order form'));
assert.ok(!packingSummary({ ...d, swag: d.swag.map(x => ({ ...x, include: x.name !== 'Pens' })) }).join().includes('Pens'));
console.log('packing ok');
