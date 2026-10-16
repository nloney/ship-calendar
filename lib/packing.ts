export const BOOTHS = ['Long Pelican (Small Banner)', 'Long Pelican (Big Banner)', 'Hardware Pelican'];
export const BANNERS = ['LE Big', 'LE Small', 'HC Big', 'HC Small', 'MF Big', 'MF Small', 'SSO Big', 'General Big', 'General Small', 'Vet Big'];
export const CARDS = ['Pearl', 'Jamel'];
export const OTHER = 'Other';

// Pearl and Jamel cards are also listed here on purpose: the card section picks
// whose card goes in the folders, the swag list counts the stacks to pack.
const DEFAULT_SWAG = [
  { name: 'Starbucks Coffee', count: '50' },
  { name: 'Badge Clips', count: '~30' },
  { name: 'Lanyards', count: '~30' },
  { name: 'Pens', count: '50' },
  { name: 'Tote Bags', count: '35' },
  { name: 'Stickers', count: '~50' },
  { name: 'Folders', count: '50' },
  { name: 'Goodie bag bags and twisties', count: '50' },
  { name: 'Pearl Business Cards', count: '50' },
  { name: 'Jamel Business Cards', count: '50' },
];

export type SwagItem = { name: string; count: string; include: boolean };
export type Packing = {
  booth: string; booth_other: string;
  banners: string[]; banners_other: string;
  card: string; card_other: string; card_count: string;
  docs: string;
  swag: SwagItem[]; swag_other: string;
};

export function defaultPacking(): Packing {
  return {
    booth: '', booth_other: '',
    banners: [], banners_other: '',
    card: '', card_other: '', card_count: '50',
    docs: '',
    swag: DEFAULT_SWAG.map(s => ({ ...s, include: true })),
    swag_other: '',
  };
}

// Fills gaps so rows saved before a field existed still load.
export function normalizePacking(p: Partial<Packing> | null | undefined): Packing {
  return { ...defaultPacking(), ...(p || {}) };
}

export function packingSummary(p: Partial<Packing> | null | undefined): string[] {
  if (!p || !Object.keys(p).length) return [];
  const n = normalizePacking(p);
  const out: string[] = [];
  const booth = n.booth === OTHER ? n.booth_other : n.booth;
  if (booth) out.push(`Booth: ${booth}`);
  const banners = [...n.banners, ...(n.banners_other ? [n.banners_other] : [])];
  if (banners.length) out.push(`Banners: ${banners.join(', ')}`);
  const card = n.card === OTHER ? n.card_other : n.card;
  if (card) out.push(`Cards: ${card}${n.card_count ? ` (${n.card_count})` : ''}`);
  const swag = n.swag.filter(s => s.include).map(s => `${s.name} (${s.count})`);
  if (n.swag_other) swag.push(n.swag_other);
  if (swag.length) out.push(`Swag: ${swag.join(', ')}`);
  if (n.docs) out.push(`Folder docs: ${n.docs}`);
  return out;
}
