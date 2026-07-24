export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://oceanx.org/.netlify/functions/ais-stream-get');
    if (!r.ok) return res.status(502).json({ error: 'OceanX error', status: r.status });
    const d = await r.json();

    const lat = d.Latitude;
    const lon = d.Longitude;
    if (lat == null || lon == null) return res.status(204).json({ error: 'No position data' });

    return res.status(200).json({
      lat, lon,
      speed:     d.Speed ?? null,
      course:    d.Course ?? null,
      timestamp: d.lastUpdated ?? null,
      location:  d.location ?? null,
      vessel:    'OceanXplorer'
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
