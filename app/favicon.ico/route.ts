export const runtime = 'nodejs';

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#020810"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#d4a843" stroke-width="4"/>
  <path d="M32 10a22 22 0 0 1 0 44 11 11 0 0 1 0-22 11 11 0 0 0 0-22Z" fill="#d4a843"/>
  <circle cx="32" cy="21" r="3.5" fill="#020810"/>
  <circle cx="32" cy="43" r="3.5" fill="#d4a843"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
