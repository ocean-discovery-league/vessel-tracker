export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  const q = (measurement, field, refId) => ({
    datasource: DS,
    query: `from(bucket: "nautilus") |> range(start: -30m) |> filter(fn: (r) => r["_measurement"] == "${measurement}") |> filter(fn: (r) => r["_field"] == "${field}") |> last()`,
    refId
  });

  const queries = [
    q('sonardyne_nav',  'latitude',    'LAT'),
    q('sonardyne_nav',  'longitude',   'LON'),
    q('herc_file_data', 'depth_herc',  'DEPTH'),
    q('lherc_file_data','depth_lherc', 'DEPTH2'),
    q('ctd',            'temperature',    'TEMP'),
    q('lhctd',          'temperature_ct', 'TEMP2'),
    q('ctd',            'salinity',       'SAL'),
    q('herc_file_data', 'saturation', 'O2'),
    q('lhO2',           'O2_percent', 'O22'),
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
      depth: getVal('DEPTH') ?? getVal('DEPTH2'),
      temp:  getVal('TEMP') ?? getVal('TEMP2'),
      sal:   getVal('SAL'),
      o2:    getVal('O2') ?? getVal('O22'),
      timestamp: d.results.LAT?.frames?.[0]?.data?.values?.[0]?.[0] ?? null,
      _debug: Object.fromEntries(
        ['DEPTH','DEPTH2','TEMP','TEMP2','SAL','O2','O22'].map(k => [
          k, {
            frames: d.results[k]?.frames?.length ?? 0,
            val: d.results[k]?.frames?.[0]?.data?.values?.[1]?.[0] ?? null
          }
        ])
      )
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
