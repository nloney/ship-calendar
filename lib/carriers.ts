export const CARRIERS: Record<string, { label: string; url: (n: string) => string }> = {
  ups:   { label: 'UPS',   url: n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  fedex: { label: 'FedEx', url: n => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  usps:  { label: 'USPS',  url: n => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
  dhl:   { label: 'DHL',   url: n => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}` },
};

export function trackingUrl(carrier: string, num: string): string | null {
  const c = CARRIERS[carrier];
  return c && num ? c.url(num) : null;
}

export function carrierLabel(carrier: string): string {
  return CARRIERS[carrier]?.label || 'Other';
}
