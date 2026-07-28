export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://nautiluslive.org/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-vessel-tracker/1.0)' }
    });
    if (!r.ok) return res.status(502).json({ error: 'Fetch failed', status: r.status });
    const html = await r.text();

    // Try several patterns — nautiluslive.org is Drupal-based and may change layout
    // Pattern 1: field with "status" in class name near "Current Status" text
    let status = null;

    const p1 = html.match(/Current Status[\s\S]{0,200}?<[^>]+>([\w][^<]{2,60})<\/[^>]+>/i);
    if (p1) status = p1[1].trim();

    // Pattern 2: common Drupal field pattern
    if (!status) {
      const p2 = html.match(/field--name-field-status[^>]*>[\s\S]*?<[^>]+>([\w][^<]{2,60})<\/[^>]+>/i);
      if (p2) status = p2[1].trim();
    }

    // Pattern 3: look for the status badge/label text after "Current Status" heading
    if (!status) {
      const p3 = html.match(/Current Status<\/[^>]+>[\s\S]{0,500}?<(?:div|span|p|h\d)[^>]*>\s*([A-Z][^<]{2,60})\s*<\//i);
      if (p3) status = p3[1].trim();
    }

    if (!status) return res.status(204).json({ error: 'Status not found' });

    return res.status(200).json({ status });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
