import axios from 'axios';

export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const radius = 10;
  const apiKey = process.env.OPENCHARGEMAP_API_KEY || 'YOUR_OPENCHARGEMAP_API_KEY';

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing latitude or longitude.' });
  }

  const apiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${radius}&maxresults=10&compact=true&verbose=false`;

  try {
    const response = await axios.get(apiUrl, {
      headers: { 'X-API-Key': apiKey }
    });
    if (!Array.isArray(response.data)) {
      return res.status(502).json({ error: 'Unexpected response from Open Charge Map.' });
    }
    const stations = response.data.map(station => ({
      name: station.AddressInfo?.Title || 'Unknown',
      lat: station.AddressInfo?.Latitude,
      lon: station.AddressInfo?.Longitude,
    })).filter(s => s.lat && s.lon);
    res.status(200).json({ stations });
  } catch (error) {
    console.error('Open Charge Map API error:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to fetch charging stations', details: error?.response?.data || error.message });
  }
}