export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ?vehicle=lilh → Little Hercules (LilH 2410), default → Hercules (Herc 2412)
  const isLilH = req.query?.vehicle === 'lilh';
  const sonarName = isLilH ? 'LilH 2410' : 'Herc 2412';

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  const q = (measurement, field, refId) => ({
    datasource: DS,
    query: `from(bucket: "nautilus") |> range(start: -30m) |> filter(fn: (r) => r["_measurement"] == "${measurement}") |> filter(fn: (r) => r["_field"] == "${field}") |> last()`,
    refId
  });

  // Sonardyne lat/lon filtered to the active ROV by name
  const sonardyneLatLon = (field, refId) => ({
    datasource: DS,
    query: `from(bucket: "nautilus") |> range(start: -30m) |> filter(fn: (r) => r["_measurement"] == "sonardyne_nav") |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> filter(fn: (r) => r["name"] == "${sonarName}") |> last(column: "_time") |> keep(columns:["_time","${field}"])`,
    refId
  });

  const queries = [
    sonardyneLatLon('latitude',  'LAT'),
    sonardyneLatLon('longitude', 'LON'),
    q('herc_file_data',  'depth_herc',             'DEPTH'),
    q('lherc_file_data', 'depth_lherc',            'DEPTH2'),
    q('ctd',             'temperature',             'TEMP'),
    q('lhctd',           'temperature_ct',          'TEMP2'),
    q('ctd',             'salinity',                'SAL'),
    q('herc_file_data',  'saturation',              'O2'),
    q('lhO2',            'O2_percent',              'O22'),
    q('bnav_data',       'vtg_track_speed_knots',   'SPD'),
  ];

  try {
    const r = await fetch(GRAFANA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, from: 'now-30m', to: 'now' })
    });
    if (!r.ok) return res.status(502).json({ error: 'Grafana error', status: r.status });

    const d = await r.json();

    // Pivot queries return data differently — extract from first frame's last row
    const getPivotVal = key => {
      const frames = d.results[key]?.frames ?? [];
      if (!frames.length) return null;
      const fields = frames[0].schema?.fields ?? [];
      const values = frames[0].data?.values ?? [];
      const colMap = {};
      fields.forEach((f, i) => { colMap[f.name] = values[i]; });
      const col = colMap[key === 'LAT' ? 'latitude' : 'longitude'] ?? [];
      return col[col.length - 1] ?? null;
    };

    const getVal = key => d.results[key]?.frames?.[0]?.data?.values?.[1]?.[0] ?? null;

    const lat = getPivotVal('LAT');
    const lon = getPivotVal('LON');
    if (lat == null || lon == null) return res.status(204).json({ error: 'No ROV data' });

    return res.status(200).json({
      lat, lon,
      depth: getVal('DEPTH') ?? getVal('DEPTH2'),
      temp:  getVal('TEMP')  ?? getVal('TEMP2'),
      sal:   getVal('SAL'),
      o2:    getVal('O2')    ?? getVal('O22'),
      speed: getVal('SPD'),
      timestamp: d.results.LAT?.frames?.[0]?.data?.values?.[0]?.[0] ?? null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
