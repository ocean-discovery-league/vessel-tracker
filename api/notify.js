export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, body, vessel, zone, timestamp, zoneDetails } = req.body || {};
  if (!title || !zone) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !toEmail) return res.status(500).json({ error: 'Email not configured' });

  const when = timestamp ? new Date(timestamp).toUTCString() : new Date().toUTCString();
  const z = zoneDetails || {};
  const toolUrl = `https://global-goal-tracker-internal.vercel.app/?zone=${encodeURIComponent(zone)}`;

  const isGoalZone = title.includes('Observation Dive');
  const alertColor = isGoalZone ? '#c0392b' : '#4a6fa5';
  const alertLabel = isGoalZone ? '🚢 POSSIBLE OBSERVATION DIVE' : '🚢 ZONE INTERSECTION';

  const detailRows = [
    ['Vessel', vessel || '—'],
    ['Zone', zone],
    ['Time (UTC)', when],
    z.lat != null ? ['Zone Centre', `${Number(z.lat).toFixed(5)}°, ${Number(z.lon).toFixed(5)}°`] : null,
    z.depth ? ['Depth Zone', z.depth] : null,
    z.geomorph ? ['Geomorphology', z.geomorph] : null,
    z.ocean ? ['Ocean Basin', z.ocean] : null,
    z.eez ? ['EEZ', z.eez] : null,
    z.mapped ? ['Seafloor Mapped', z.mapped === 'Y' ? '✅ Yes' : '❌ No'] : null,
    z.observed ? ['Previously Observed', z.observed === 'Y' ? '✅ Yes' : '❌ No'] : null,
  ].filter(Boolean);

  const tableRows = detailRows.map(([label, value], i) =>
    `<tr><td style="padding:7px 12px;background:${i % 2 === 0 ? '#041018' : '#061420'};color:#41B9C3;white-space:nowrap;font-weight:600;">${label}</td>
         <td style="padding:7px 12px;background:${i % 2 === 0 ? '#041018' : '#061420'};color:#e0e6f0;">${value}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0E2446;color:#e0e6f0;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
      <div style="background:#041828;padding:18px 24px;border-bottom:3px solid ${alertColor};">
        <div style="font-size:11px;font-weight:700;color:${alertColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${alertLabel}</div>
        <div style="font-size:20px;font-weight:700;color:#fff;line-height:1.3;">${zone}</div>
        <div style="font-size:12px;color:#8899bb;margin-top:4px;">${vessel || ''}</div>
      </div>
      <div style="padding:20px 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;border-radius:6px;overflow:hidden;">
          ${tableRows}
        </table>
        <div style="margin-top:20px;text-align:center;">
          <a href="${toolUrl}" style="display:inline-block;padding:12px 28px;background:${alertColor};color:#fff;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
            → Open Zone in Tracker
          </a>
        </div>
        ${body ? `<div style="margin-top:16px;padding:10px 14px;background:#041018;border-left:3px solid #187D8B;border-radius:4px;font-size:11px;color:#8899bb;white-space:pre-line;">${body}</div>` : ''}
      </div>
      <div style="padding:10px 24px;background:#041018;font-size:10px;color:#41B9C3;display:flex;justify-content:space-between;">
        <span>Ocean Discovery League — Vessel Zone Monitor</span>
        <span>${when}</span>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Vessel Monitor <onboarding@resend.dev>',
      to: [toEmail],
      subject: `🚢 Global Exploration Goal Zone Intersection: ${vessel || 'Vessel'} → ${zone}`,
      html
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: 'Resend error', detail: err });
  }

  return res.status(200).json({ ok: true });
}
