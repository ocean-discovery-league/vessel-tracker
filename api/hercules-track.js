export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ?vehicle=herc (default) or ?vehicle=lilh
  const sonarName = req.query?.vehicle === 'lilh' ? 'LilH 2410' : 'Herc 2412';

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  try {
    const r = await fetch(GRAFANA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [{
          datasource: DS,
          query: `from(bucket: "nautilus") |> range(start: -48h) |> filter(fn: (r) => r["_measurement"] == "sonardyne_nav") |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> filter(fn: (r) => r["name"] == "${sonarName}") |> sort(columns:["_time"]) |> keep(columns:["_time","latitude","longitude","depth"])`,
          refId: 'A'
        }],
        from: 'now-48h',
        to: 'now'
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'Grafana error', status: r.status });

    const d = await r.json();
    const frames = d.results?.A?.frames ?? [];

    const points = [];
    for (const frame of frames) {
      const fields = frame.schema?.fields ?? [];
      const values = frame.data?.values ?? [];
      const colMap = {};
      fields.forEach((f, i) => { colMap[f.name] = values[i]; });

      const times = colMap['_time'] ?? [];
      for (let i = 0; i < times.length; i++) {
        const lat = colMap['latitude']?.[i];
        const lon = colMap['longitude']?.[i];
        if (lat != null && lon != null) {
          points.push({ lat, lon, depth: colMap['depth']?.[i] ?? null, ts: times[i] });
        }
      }
    }

    points.sort((a, b) => a.ts - b.ts);
    return res.status(200).json({ points, vehicle: sonarName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
