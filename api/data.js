const BLOB_ID = process.env.JSONBLOB_ID || '019ca8b7-fa29-7eaf-b00e-f909b00ffc62';
const BASE_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  try {
    if (action === 'getData') {
      const response = await fetch(BASE_URL, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`JSONBlob error: ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data || { properties: [], activity: [] });
    }

    if (action === 'saveData') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);

      const response = await fetch(BASE_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`JSONBlob save error: ${response.status}`);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action. Use ?action=getData or ?action=saveData' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
