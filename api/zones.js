const GEOJSON_URL = 'https://github.com/ocean-discovery-league/vessel-tracker/releases/download/v1.0/V9.2.2_Buffer5k_20260602.geojson';

// Fetched and parsed once per container lifetime
let _features = null;
async function getFeatures() {
  if (!_features) {
    const res = await fetch(GEOJSON_URL);
    if (!res.ok) throw new Error(`Failed to fetch zone data: ${res.status}`);
    const data = await res.json();
    _features = data.features;
  }
  return _features;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      ocean,
      mapped,
      observed,
      geomorph,
      depth_min,
      depth_max,
      jurisdiction,
      challenger150,
      format = 'geojson',
      limit = '10000',
      offset = '0',
    } = req.query;

    let features = await getFeatures();

    // ── Filters ──────────────────────────────────────────────────────────────
    if (ocean) {
      const q = ocean.toLowerCase();
      features = features.filter(f => f.properties.OceanBasin.toLowerCase().includes(q));
    }
    if (mapped !== undefined) {
      const want = mapped === 'true' || mapped === '1' || mapped === 'yes';
      features = features.filter(f => (f.properties.MappedYN === 'Y') === want);
    }
    if (observed !== undefined) {
      const want = observed === 'true' || observed === '1' || observed === 'yes';
      features = features.filter(f => (f.properties.ObservedYN === 'Y') === want);
    }
    if (geomorph) {
      const q = geomorph.toLowerCase();
      features = features.filter(f => f.properties.Geomorphorphology.toLowerCase().includes(q));
    }
    if (depth_min !== undefined) {
      const min = -Math.abs(parseInt(depth_min, 10));
      features = features.filter(f => f.properties.PointDepth <= min);
    }
    if (depth_max !== undefined) {
      const max = -Math.abs(parseInt(depth_max, 10));
      features = features.filter(f => f.properties.PointDepth >= max);
    }
    if (jurisdiction) {
      const q = jurisdiction.toLowerCase();
      features = features.filter(f => f.properties.EEZ_GEONAME.toLowerCase().includes(q));
    }
    if (challenger150 !== undefined) {
      const want = challenger150 === 'true' || challenger150 === '1' || challenger150 === 'yes';
      features = features.filter(f => (f.properties.Challenger150YN === 'Y') === want);
    }

    // ── Pagination ────────────────────────────────────────────────────────────
    const total = features.length;
    const off   = Math.max(0, parseInt(offset, 10) || 0);
    const lim   = Math.min(10000, Math.max(1, parseInt(limit, 10) || 10000));
    features = features.slice(off, off + lim);

    // ── Format ────────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const header = 'zone_id,longitude,latitude,ocean_basin,geomorphology,depth_class,depth_m,jurisdiction,eez_geoname,territory,sovereign,bathymetry_mapped,biologically_observed,challenger150,poc_range,shore_distance_m,seafloor_composition,uniqueness';
      const rows = features.map(f => {
        const p = f.properties;
        const lon = parseFloat(p.Point_LongitudeX);
        const lat = parseFloat(p.Point_LatitudeY);
        return [
          p.Name, lon, lat, p.OceanBasin, p.Geomorphorphology, p.DepthZone, p.PointDepth,
          `"${p.EEZ_GEONAME}"`, `"${p.TerritoryName}"`, `"${p.SovereignName}"`,
          p.MappedYN === 'Y', p.ObservedYN === 'Y', p.Challenger150YN === 'Y',
          p.POCRange, Math.round(p.NearestShoreMeters), p.SeafloorComposition,
          p.Uniqueness?.toFixed(6) ?? ''
        ].join(',');
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="deep-sea-exploration-goals.csv"');
      return res.status(200).send(header + '\n' + rows.join('\n'));
    }

    // GeoJSON — points by default, polygons if format=geojson-polygons
    const includePolygons = format === 'geojson-polygons';

    const outFeatures = features.map(f => {
      const p = f.properties;
      const lon = parseFloat(p.Point_LongitudeX);
      const lat = parseFloat(p.Point_LatitudeY);
      return {
        type: 'Feature',
        id: p.Name,
        geometry: includePolygons
          ? f.geometry
          : { type: 'Point', coordinates: [lon, lat] },
        properties: {
          zone_id:               p.Name,
          ocean_basin:           p.OceanBasin,
          geomorphology:         p.Geomorphorphology,
          depth_class:           p.DepthZone,
          depth_m:               p.PointDepth,
          jurisdiction:          p.EEZ_GEONAME,
          territory:             p.TerritoryName,
          territory_iso:         p.TerritoryISO,
          sovereign:             p.SovereignName,
          sovereign_iso:         p.SovereignISO,
          bathymetry_mapped:     p.MappedYN === 'Y',
          biologically_observed: p.ObservedYN === 'Y',
          challenger_150:        p.Challenger150YN === 'Y',
          poc_range:             p.POCRange,
          shore_distance_m:      Math.round(p.NearestShoreMeters),
          seafloor_composition:  p.SeafloorComposition,
          uniqueness:            p.Uniqueness ?? null,
          zone_radius_m:         p.BUFF_DIST,
        }
      };
    });

    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        total_matching: total,
        returned: outFeatures.length,
        offset: off,
        limit: lim,
        geometry: includePolygons ? 'polygon' : 'point',
        source: 'Ocean Discovery League — Global Deep Sea Exploration Goals v9.2.2',
        license: 'CC BY 4.0',
        more_info: 'https://www.oceandiscoveryleague.org/global-deep-sea-exploration-goals',
      },
      features: outFeatures,
    };

    res.setHeader('Content-Type', 'application/geo+json');
    return res.status(200).json(geojson);

  } catch (err) {
    console.error('zones API error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
