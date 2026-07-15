export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  const query = (field, refId) => ({
    datasource: DS,
    query: `from(bucket: "nautilus") |> range(start: -5m) |> filter(fn: (r) => r._measurement == "sonardyne_nav" and r._field == "${field}") |> last()`,
    refId
  });

  try {
    const r = await fetch(GRAFANA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [query('latitude', 'LAT'), query('longitude', 'LON')], from: 'now-5m', to: 'now' })
    });
    if (!r.ok) return res.status(502).json({ error: 'Grafana error', status: r.status });

    const d = await r.json();
    const getVal = key => d.results[key]?.frames?.[0]?.data?.values?.[1]?.[0] ?? null;
    const lat = getVal('LAT');
    const lon = getVal('LON');
    const timestamp = d.results.LAT?.frames?.[0]?.data?.values?.[0]?.[0] ?? null;

    if (lat == null || lon == null) return res.status(204).json({ error: 'No ROV data' });

    return res.status(200).json({ lat, lon, timestamp });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
