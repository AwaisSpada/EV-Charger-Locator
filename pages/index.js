import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { getDistance } from 'geolib';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Home() {
  const [userLocation, setUserLocation] = useState(null);
  const [stations, setStations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedStation, setSelectedStation] = useState(null);
  const [route, setRoute] = useState(null);
  const [drivingMode, setDrivingMode] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (drivingMode) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
          err => console.error(err),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        });
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [drivingMode]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    if (!search) return;
    setLoading(true);
    try {
      const resp = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: search,
            format: "json",
            limit: 1
          }
        }
      );
      if (resp.data && resp.data.length > 0) {
        setUserLocation([
          parseFloat(resp.data[0].lat),
          parseFloat(resp.data[0].lon)
        ]);
        setSelectedStation(null)
      } else {
        setError("Location not found");
      }
    } catch (err) {
      setError("Failed to search location");
    }
    setLoading(false);
  };


  useEffect(() => {
    if (userLocation) {
      axios.get('/api/stations', { params: { lat: userLocation[0], lon: userLocation[1] } })
        .then(res => setStations(res.data.stations));
    }
  }, [userLocation]);

  // Fetch route when selectedStation changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (userLocation && selectedStation) {
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${selectedStation.lon},${selectedStation.lat}?overview=full&geometries=geojson`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
            setRouteDistance(data.routes[0].distance); // meters
          } else {
            setRoute(null);
            setRouteDistance(null);
          }
        } catch {
          setRoute(null);
          setRouteDistance(null);
        }
      } else {
        setRoute(null);
        setRouteDistance(null);
      }
    };
    fetchRoute();
  }, [userLocation, selectedStation]);

  // Calculate distances for each station
  const stationsWithDistance = userLocation && stations.length > 0
    ? stations.map(station => {
        const distance = getDistance(
          { latitude: userLocation[0], longitude: userLocation[1] },
          { latitude: station.lat, longitude: station.lon }
        );
        return { ...station, distance };
      })
    : [];

  return (
    <main style={{ minHeight: '100vh', background: '#f6f7fb', padding: 0, margin: 0 }}>
      <header style={{ textAlign: 'center', padding: '2rem 0 1rem 0', background: '#fff', boxShadow: '0 2px 8px #0001' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#2d3748' }}>EV Charging Location Finder</h1>
        <p style={{ color: '#4a5568', fontSize: '1.15rem', marginTop: 8 }}>
          Find the nearest electric vehicle charging stations. Search by address or click on the map!
        </p>
      </header>
      <section style={{
        maxWidth: 1200,
        margin: '2rem auto',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 16px #0002',
        padding: 24,
        display: 'flex',
        flexDirection: 'row',
        gap: 32,
        minHeight: 500,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {/* Map Column */}
        <div style={{ flex: 2, minWidth: 340, maxWidth: 700 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={() => setDrivingMode(dm => !dm)}
              style={{ padding: '8px 18px', borderRadius: 6, background: drivingMode ? '#38a169' : '#cbd5e0', color: drivingMode ? '#fff' : '#2d3748', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
              aria-pressed={drivingMode}
            >
              {drivingMode ? 'Driving Mode: ON' : 'Driving Mode: OFF'}
            </button>
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }} aria-label="Search for a location">
            <label htmlFor="location-search" style={{ fontWeight: 500, color: '#2d3748' }}>Location:</label>
            <input
              id="location-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Enter address, city, or place..."
              style={{ flex: 1, padding: 10, fontSize: 16, borderRadius: 6, border: '1px solid #cbd5e0' }}
              aria-label="Search location"
            />
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', fontSize: 16, borderRadius: 6, background: '#3182ce', color: '#fff', border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <span>Searching...</span> : <span>Search</span>}
            </button>
          </form>
          {error && <div role="alert" style={{ color: '#e53e3e', marginBottom: 8, fontWeight: 500 }}>{error}</div>}
          <div style={{ marginBottom: 12, color: '#4a5568', fontSize: 15 }}>
            <span>Tip: You can also click on the map to select a location.</span>
          </div>
          <div style={{ minHeight: 40, marginBottom: 10 }}>
            {userLocation && stations.length === 0 && !loading && (
              <span style={{ color: '#ed8936', fontWeight: 500 }}>No charging stations found nearby.</span>
            )}
          </div>
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 350 }}>
            <Map userLocation={userLocation} stations={stationsWithDistance} onLocationSelect={setUserLocation} selectedStation={selectedStation} route={route} onStationSelect={setSelectedStation} drivingMode={drivingMode} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, alignItems: 'center', fontSize: 14, color: '#4a5568' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png" alt="Current location marker" width={20} height={32} />
          You
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" alt="Station marker" width={20} height={32} />
          Charging Station
        </span>
      </div>
          {/* {drivingMode && userLocation && (
            <div style={{ margin: '16px 0 0 0', textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: '#3182ce', marginBottom: 8 }}>Street View (Preview)</div>
              <img
                src={`https://maps.googleapis.com/maps/api/streetview?size=400x150&location=${userLocation[0]},${userLocation[1]}&fov=90&heading=235&pitch=10&key=YOUR_GOOGLE_STREET_VIEW_API_KEY`}
                alt="Street View Preview"
                style={{ borderRadius: 10, border: '1px solid #cbd5e0', width: 400, maxWidth: '100%' }}
              />
              <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                <span>Replace <b>YOUR_GOOGLE_STREET_VIEW_API_KEY</b> with your own API key for live images.</span>
              </div>
            </div>
          )} */}
        </div>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 400, height: 600, overflowY: 'auto', background: '#f7fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 20, color: '#2d3748', marginBottom: 12, textAlign: 'center' }}>Charging Stations</div>
          {stationsWithDistance.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stationsWithDistance.map((station, idx) => (
                <div key={idx} style={{ background: selectedStation === station ? '#ebf8ff' : '#fff', border: '1px solid #cbd5e0', borderRadius: 10, padding: 16, boxShadow: selectedStation === station ? '0 2px 8px #3182ce33' : '0 1px 4px #0001', cursor: 'pointer', transition: 'box-shadow .2s' }} onClick={() => setSelectedStation(station)}>
                  <div style={{ fontWeight: 600, fontSize: 18, color: '#2d3748' }}>{station.name}</div>
                  <div style={{ color: '#4a5568', fontSize: 15, margin: '4px 0 0 0' }}>Lat: {station.lat}, Lon: {station.lon}</div>
                  <div style={{ color: '#3182ce', fontSize: 15, marginTop: 4 }}>Distance: {(station.distance / 1000).toFixed(2)} km</div>
                  {selectedStation === station && route && (
                    <div style={{ color: '#38a169', marginTop: 6 }}>Route is shown on the map</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#a0aec0', textAlign: 'center', marginTop: 32 }}>No charging stations found.</div>
          )}
        </div>
      </section>
      <footer style={{ textAlign: 'center', color: '#a0aec0', fontSize: 14, margin: '2rem 0 1rem 0' }}>
        &copy; {new Date().getFullYear()} EV Charging Finder
      </footer>
    </main>
  );
}
