const key = process.env.INDEXNOW_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!key || !siteUrl) {
  console.log('IndexNow skipped: INDEXNOW_KEY or NEXT_PUBLIC_SITE_URL is not configured.');
  process.exit(0);
}

console.log('IndexNow skipped in local deployment script.');
