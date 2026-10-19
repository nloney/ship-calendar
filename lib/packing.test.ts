import assert from 'node:assert/strict';
import { defaultPacking, normalizePacking, packingSummary, OTHER } from './packing';

const d = defaultPacking();
assert.equal(d.swag.length, 10);
assert.ok(d.swag.every(s => s.include), 'swag defaults to included');
assert.deepEqual(d.swag.find(s => s.name === 'Tote Bags'), { name: 'Tote Bags', count: '35', include: true });
assert.equal(normalizePacking({ booth: 'Hardware Pelican' } as never).swag.length, 10);
assert.deepEqual(packingSummary({}), []);
const s = packingSummary({ ...d, booths: { 'Hardware Pelican': '2', 'Long Pelican (Big Banner)': '1' }, booth_other: 'Tabletop', booth_other_count: '3', banners: ['LE Big'], card: 'Jamel', docs: 'Order form' });
assert.ok(s.includes('Booths: Hardware Pelican x2, Long Pelican (Big Banner) x1, Tabletop x3') && s.includes('Banners: LE Big') && s.includes('Cards: Jamel (50)') && s.includes('Folder docs: Order form'));
assert.ok(!packingSummary({ ...d, swag: d.swag.map(x => ({ ...x, include: x.name !== 'Pens' })) }).join().includes('Pens'));
// rows saved when booth was a single choice still load
assert.deepEqual(normalizePacking({ booth: 'Hardware Pelican' } as never).booths, { 'Hardware Pelican': '1' });
assert.equal(normalizePacking({ booth: OTHER, booth_other: 'Tabletop' } as never).booth_other_count, '1');
console.log('packing ok');
