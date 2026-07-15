export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  const q = (measurement, field, refId) => ({
    datasource: DS,
    query: `from(bucket: "nautilus") |> range(start: -5m) |> filter(fn: (r) => r._measurement == "${measurement}" and r._field == "${field}") |> last()`,
    refId
  });

  const queries = [
    q('sonardyne_nav', 'latitude',   'LAT'),
    q('sonardyne_nav', 'longitude',  'LON'),
    q('herc_file_data','depth_herc', 'DEPTH'),
    q('ctd',           'temperature','TEMP'),
    q('ctd',           'salinity',   'SAL'),
    q('herc_file_data','saturation', 'O2'),
  ];

  try {
    const r = await fetch(GRAFANA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, from: 'now-5m', to: 'now' })
    });
    if (!r.ok) return res.status(502).json({ error: 'Grafana error', status: r.status });

    const d = await r.json();
    const getVal = key => d.results[key]?.frames?.[0]?.data?.values?.[1]?.[0] ?? null;

    const lat   = getVal('LAT');
    const lon   = getVal('LON');
    if (lat == null || lon == null) return res.status(204).json({ error: 'No ROV data' });

    return res.status(200).json({
      lat, lon,
      depth: getVal('DEPTH'),
      temp:  getVal('TEMP'),
      sal:   getVal('SAL'),
      o2:    getVal('O2'),
      timestamp: d.results.LAT?.frames?.[0]?.data?.values?.[0]?.[0] ?? null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
