export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch(`https://www.whoi.edu/cms/maps/Atlantis.kml?rev=${Date.now()}`);
    if (!r.ok) return res.status(502).json({ error: 'WHOI error', status: r.status });
    const xml = await r.text();

    // Parse current position from first <Point><coordinates>lon,lat,alt</coordinates>
    const coordMatch = xml.match(/<Point>\s*<coordinates>([-\d.]+),([-\d.]+)/);
    if (!coordMatch) return res.status(204).json({ error: 'No coordinates found' });

    const lon = parseFloat(coordMatch[1]);
    const lat = parseFloat(coordMatch[2]);
    if (isNaN(lat) || isNaN(lon)) return res.status(204).json({ error: 'Invalid coordinates' });

    // Extract timestamp from description if present
    const tsMatch = xml.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/);

    return res.status(200).json({
      lat, lon,
      timestamp: tsMatch ? tsMatch[1] : null,
      vessel: 'R/V Atlantis'
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
