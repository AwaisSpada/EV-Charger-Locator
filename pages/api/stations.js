import axios from 'axios';

const AMENITIES_KEYWORDS = {
  'coffee': 'Coffee Shop',
  'cafe': 'Café',
  'restaurant': 'Restaurant',
  'shop': 'Shop',
  'market': 'Market',
  'mall': 'Shopping Mall',
  'supermarket': 'Supermarket',
  'hotel': 'Hotel',
  'motel': 'Motel',
  'toilet': 'Restrooms',
  'bathroom': 'Restrooms',
  'restroom': 'Restrooms',
  'wc': 'Restrooms',
  'food': 'Food',
  'dining': 'Dining',
  'store': 'Store',
  'wifi': 'WiFi',
  'internet': 'WiFi',
  'parking': 'Parking',
  'park': 'Park',
  'playground': 'Playground',
  'picnic': 'Picnic Area',
  'lounge': 'Lounge',
  'wait': 'Waiting Area',
  'charge': 'Fast Charging'
};


const cache = {
  data: {},
  timestamp: {},
  CACHE_TTL: 10 * 60 * 1000 
};

export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const radius = req.query.radius || 100; 
  const maxResults = req.query.maxResults || 20; 
  const apiKey = process.env.OPENCHARGEMAP_API_KEY;

  if (!lat || !lon) {
    return res.status(400).json({ 
      error: 'Missing latitude or longitude parameters.',
      success: false 
    });
  }

  const cacheKey = `${lat}_${lon}_${radius}`;


  if (
    cache.data[cacheKey] && 
    cache.timestamp[cacheKey] && 
    (Date.now() - cache.timestamp[cacheKey]) < cache.CACHE_TTL
  ) {
    return res.status(200).json({ 
      stations: cache.data[cacheKey],
      cached: true,
      timestamp: cache.timestamp[cacheKey]
    });
  }

  const apiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${radius}&maxresults=${maxResults}&compact=true&verbose=false`;

  try {
   
    const response = await axios.get(apiUrl, {
      headers: { 'X-API-Key': apiKey },
      timeout: 8000 
    });

    if (!Array.isArray(response.data)) {
      return res.status(502).json({ 
        error: 'Unexpected response format from Open Charge Map API.',
        success: false
      });
    }

    const stations = response.data.map(station => {

      const stationData = {
        id: station.ID,
        name: station.AddressInfo?.Title || 'Unknown Station',
        lat: station.AddressInfo?.Latitude,
        lon: station.AddressInfo?.Longitude,
        address: station.AddressInfo?.AddressLine1 || '',
        town: station.AddressInfo?.Town || '',
        stateOrProvince: station.AddressInfo?.StateOrProvince || '',
        postcode: station.AddressInfo?.Postcode || '',
        country: station.AddressInfo?.Country?.Title || '',
        distance: station.AddressInfo?.Distance,
        connections: Array.isArray(station.Connections) ? station.Connections.length : 0,
        connectionTypes: Array.isArray(station.Connections) 
          ? station.Connections.map(conn => ({
              type: conn.ConnectionType?.Title || 'Unknown',
              level: conn.Level?.Title || 'Unknown',
              amps: conn.Amps,
              voltage: conn.Voltage
            }))
          : [],
        operatorInfo: station.OperatorInfo?.Title || 'Unknown Operator',
        usageType: station.UsageType?.Title || 'Unknown Usage Type',
        statusType: station.StatusType?.Title || 'Unknown Status',
        dateLastVerified: station.DateLastVerified || null,
        relatedUrl: station.AddressInfo?.RelatedURL || '',
      };

      const amenitiesSet = new Set();
      
      const textToCheck = [
        stationData.name,
        stationData.address,
        stationData.relatedUrl,
        station.AddressInfo?.AccessComments || '',
        station.AddressInfo?.GeneralComments || ''
      ].join(' ').toLowerCase();
      
      Object.entries(AMENITIES_KEYWORDS).forEach(([keyword, amenity]) => {
        if (textToCheck.includes(keyword)) {
          amenitiesSet.add(amenity);
        }
      });
      
      if (stationData.usageType && !['Unknown', 'Public', 'Private'].includes(stationData.usageType)) {
        amenitiesSet.add(stationData.usageType);
      }
      
      if (stationData.connectionTypes.some(
        conn => conn.level.includes('3') || conn.level.includes('DC') || conn.level.includes('Fast')
      )) {
        amenitiesSet.add('Fast Charging');
      }
      
      stationData.amenities = Array.from(amenitiesSet);
      
      return stationData;
    }).filter(s => s.lat && s.lon);

    cache.data[cacheKey] = stations;
    cache.timestamp[cacheKey] = Date.now();

    res.status(200).json({ 
      stations,
      success: true,
      cached: false
    });
  } catch (error) {
    console.error('Open Charge Map API error:', error?.response?.data || error.message || error);
    
    if (cache.data[cacheKey]) {
      return res.status(200).json({ 
        stations: cache.data[cacheKey],
        cached: true,
        stale: true,
        timestamp: cache.timestamp[cacheKey],
        warning: 'Using stale cached data due to API error'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch charging stations', 
      details: error?.response?.data || error.message,
      success: false
    });
  }
}