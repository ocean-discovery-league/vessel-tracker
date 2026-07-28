export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GRAFANA = 'https://graphs.oceanexplorationtrust.org/api/ds/query';
  const DS = { type: 'influxdb', uid: '8Mc90TYVz' };

  try {
    const r = await fetch(GRAFANA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [{
          datasource: DS,
          query: `from(bucket: "nautilus") |> range(start: -24h) |> filter(fn: (r) => r["_measurement"] == "sonardyne_nav") |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> filter(fn: (r) => r["name"] == "Sntry 5206") |> last(column: "_time")`,
          refId: 'A'
        }],
        from: 'now-24h',
        to: 'now'
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'Grafana error', status: r.status });

    const d = await r.json();
    const frames = d.results?.A?.frames ?? [];
    if (!frames.length) return res.status(204).json({ error: 'No Sentry data' });

    // Each frame corresponds to a file/path group; find the most recent Sentry row across all frames
    let best = null;
    let bestTime = 0;

    for (const frame of frames) {
      const fields = frame.schema?.fields ?? [];
      const values = frame.data?.values ?? [];
      const colMap = {};
      fields.forEach((f, i) => { colMap[f.name] = values[i]; });

      const times = colMap['_time'] ?? [];
      if (!times.length) continue;

      const idx = times.length - 1;
      const t = times[idx];
      if (t > bestTime) {
        bestTime = t;
        best = {};
        for (const [k, arr] of Object.entries(colMap)) {
          best[k] = arr[idx];
        }
      }
    }

    if (!best || best.latitude == null || best.longitude == null) {
      return res.status(204).json({ error: 'No Sentry position' });
    }

    return res.status(200).json({
      lat: best.latitude,
      lon: best.longitude,
      depth: best.depth ?? null,
      status: best.status ?? null,
      horizontal_error: best.horizontal_error_major ?? null,
      timestamp: bestTime
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
