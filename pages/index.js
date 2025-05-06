import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Home() {
  const [userLocation, setUserLocation] = useState(null);
  const [stations, setStations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, []);

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

  return (
    <main style={{ minHeight: '100vh', background: '#f6f7fb', padding: 0, margin: 0 }}>
      <header style={{ textAlign: 'center', padding: '2rem 0 1rem 0', background: '#fff', boxShadow: '0 2px 8px #0001' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#2d3748' }}>EV Charging Location Finder</h1>
        <p style={{ color: '#4a5568', fontSize: '1.15rem', marginTop: 8 }}>
          Find the nearest electric vehicle charging stations. Search by address or click on the map!
        </p>
      </header>
      <section style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px #0002', padding: 24 }}>
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
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <Map userLocation={userLocation} stations={stations} onLocationSelect={setUserLocation} />
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
      </section>
      <footer style={{ textAlign: 'center', color: '#a0aec0', fontSize: 14, margin: '2rem 0 1rem 0' }}>
        &copy; {new Date().getFullYear()} EV Charging Finder
      </footer>
    </main>
  );
}
