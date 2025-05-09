import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { getDistance } from 'geolib';

const Map = dynamic(() => import('../components/Map'), { ssr: false });
const PieChart = dynamic(() => import('../components/PieChart'), { ssr: false });

export default function Home() {
  const [userLocation, setUserLocation] = useState(null);
  const [stations, setStations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingStations, setFetchingStations] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeStationId, setActiveStationId] = useState(null); 
  const [route, setRoute] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [error, setError] = useState("");
  
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);

  const getStationId = useCallback((station) => {
    return station.id || `${station.name}_${station.lat}_${station.lon}`;
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        err => setError('Failed to get initial location. Please ensure location services are enabled.')
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeStationId) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
          err => setError('Failed to track location during driving mode.'),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
        
        locationIntervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
            null,
            { maximumAge: 10000 }
          );
        }, 12000);
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    }
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [activeStationId]);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    setLoading(true);
    setError("");
    
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
        setSelectedStation(null);
        setActiveStationId(null);
        setRoute(null);
      } else {
        setError("Location not found. Please try a different search term.");
      }
    } catch (err) {
      setError("Error searching for location. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const fetchStations = async () => {
      if (!userLocation) return;
      
      setFetchingStations(true);
      try {
        const res = await axios.get('/api/stations', { 
          params: { lat: userLocation[0], lon: userLocation[1] }
        });
        
        if (res.data && Array.isArray(res.data.stations)) {
          setStations(res.data.stations);
          if (selectedStation) {
            const distanceFromPrev = getDistance(
              { latitude: userLocation[0], longitude: userLocation[1] },
              { latitude: selectedStation.lat, longitude: selectedStation.lon }
            );
            
            if (distanceFromPrev > 10000 && !activeStationId) {
              setSelectedStation(null);
              setRoute(null);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching stations:", err);
        setError("Failed to fetch nearby charging stations.");
      } finally {
        setFetchingStations(false);
      }
    };

    fetchStations();
  }, [userLocation, selectedStation, activeStationId]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (userLocation && selectedStation) {
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${selectedStation.lon},${selectedStation.lat}?overview=full&geometries=geojson`;
        
        try {
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.routes && data.routes[0]) {
            setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
            setRouteDistance(data.routes[0].distance);
          } else {
            setRoute(null);
            setRouteDistance(null);
            if (activeStationId === getStationId(selectedStation)) {
              setError("Could not calculate route to this station.");
            }
          }
        } catch (err) {
          console.error("Route calculation error:", err);
          setRoute(null);
          setRouteDistance(null);
          if (activeStationId === getStationId(selectedStation)) {
            setError("Error calculating route to station.");
          }
        }
      } else {
        setRoute(null);
        setRouteDistance(null);
      }
    };
    
    fetchRoute();
  }, [userLocation, selectedStation, activeStationId, getStationId]);

  const toggleDrivingMode = useCallback((station) => {
    const stationId = getStationId(station);
    
    if (activeStationId === stationId) {
      setActiveStationId(null);
      setRoute(null);
      setRouteDistance(null);
      return;
    }
    
    setActiveStationId(stationId);
    setSelectedStation(station);
  }, [activeStationId, getStationId]);
  const stationsWithDistance = useMemo(() => {
    if (!userLocation || stations.length === 0) return [];
    
    return stations.map(station => {
      const distance = getDistance(
        { latitude: userLocation[0], longitude: userLocation[1] },
        { latitude: station.lat, longitude: station.lon }
      );
      return { ...station, distance };
    }).sort((a, b) => a.distance - b.distance);
  }, [userLocation, stations]);


  const chartData = useMemo(() => {
    const bins = [
      { label: '0-5 km', min: 0, max: 5, count: 0 },
      { label: '5-10 km', min: 5, max: 10, count: 0 },
      { label: '10-15 km', min: 10, max: 15, count: 0 },
      { label: '15-20 km', min: 15, max: 20, count: 0 },
      { label: '20+ km', min: 20, max: Infinity, count: 0 }
    ];

    bins.forEach(bin => bin.count = 0);

    stationsWithDistance?.forEach(station => {
      const distKm = station.distance / 1000;
      if (distKm >= 0 && distKm <= 5) bins[0].count++;
      else if (distKm >= 5 && distKm <= 10) bins[1].count++;
      else if (distKm >= 10 && distKm <= 15) bins[2].count++;
      else if (distKm >= 15 && distKm <= 20) bins[3].count++;
      else if (distKm >= 20) bins[4].count++;
    });

    return bins;
  }, [stationsWithDistance]);

  const recommendedStation = useMemo(() => {
    if (stationsWithDistance.length === 0) return null;
    return stationsWithDistance.find(s => (s.amenities && s.amenities.length > 0)) 
           || stationsWithDistance[0];
  }, [stationsWithDistance]);

  const stationsGreaterThan10Km = useMemo(() => {
    return stationsWithDistance.filter(station => (station.distance / 1000) > 10);
  }, [stationsWithDistance]);

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
        <div style={{ flex: 2, minWidth: 340, maxWidth: 700 }}>
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
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '10px 20px', 
                fontSize: 16, 
                borderRadius: 6, 
                background: loading ? '#90cdf4' : '#3182ce', 
                color: '#fff', 
                border: 'none', 
                fontWeight: 600, 
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
            >
              {loading ? <span>Searching...</span> : <span>Search</span>}
            </button>
          </form>
          
          {error && (
            <div style={{ marginBottom: 12, color: '#e53e3e', fontSize: 15, padding: '8px 12px', background: '#fff5f5', borderRadius: 6, border: '1px solid #fed7d7' }}>
              {error}
            </div>
          )}
          
          <div style={{ marginBottom: 12, color: '#4a5568', fontSize: 15 }}>
            <span>Tip: You can also click on the map to select a location.</span>
          </div>
          
          <div style={{ minHeight: 40, marginBottom: 10 }}>
            {userLocation && stationsWithDistance.length === 0 && !fetchingStations && (
              <span style={{ color: '#ed8936', fontWeight: 500 }}>No charging stations found nearby.</span>
            )}
            {fetchingStations && (
              <span style={{ color: '#3182ce', fontWeight: 500 }}>Finding nearby stations...</span>
            )}
          </div>
          
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 350 }}>
            <Map 
              userLocation={userLocation} 
              stations={stationsWithDistance} 
              onLocationSelect={setUserLocation} 
              selectedStation={selectedStation} 
              route={route} 
              onStationSelect={setSelectedStation} 
              activeStationId={activeStationId}
              getStationId={getStationId}
            />
          </div>
          
          <div style={{ marginTop: 10, display: 'flex', gap: 16, alignItems: 'center', fontSize: 14, color: '#4a5568' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 20, background: '#3182ce', borderRadius: '50%' }}></div>
              You{activeStationId ? ' (Driving Mode)' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 20, background: '#e53e3e', borderRadius: '50%' }}></div>
              Charging Station
            </span>
            {route && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 24, height: 4, background: '#3182ce' }}></div>
                Route ({(routeDistance / 1000).toFixed(1)} km)
              </span>
            )}
          </div>
        </div>
        
      
        <div style={{ flex: 1, minWidth: 260, maxWidth: 400, height: 600, overflowY: 'auto', background: '#f7fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
     
          <PieChart 
            data={chartData} 
            total={stationsWithDistance?.length} 
            loading={fetchingStations}
          />

          <div style={{ margin: '18px 0 10px 0', padding: '12px', background: '#edf2f7', borderRadius: 8, color: '#2d3748' }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Stations &gt; 10km away</h4>
            {stationsGreaterThan10Km.length === 0 ? (
              <div style={{ color: '#718096', fontSize: 14, marginTop: 6 }}>No stations farther than 10km.</div>
            ) : (
              <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none' }}>
                {stationsGreaterThan10Km.map(station => (
                  <li key={station.id || station.name + station.lat + station.lon} style={{ marginBottom: 6, fontSize: 15 }}>
                    <span style={{ fontWeight: 500 }}>{station.name || 'Unnamed Station'}</span>
                    <span style={{ color: '#4a5568', marginLeft: 6 }}>({(station.distance / 1000).toFixed(2)} km)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: 20, color: '#2d3748', marginBottom: 12, textAlign: 'center' }}>
            Charging Stations
          </div>
          
          {stationsWithDistance?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stationsWithDistance.map((station) => {
                const stationId = getStationId(station);
                const isActive = activeStationId === stationId;
                const isSelected = selectedStation === station;
                const isRecommended = recommendedStation === station;

                
                return (
                  <div 
                    key={stationId} 
                    style={{ 
                      background: isSelected ? '#ebf8ff' : '#fff', 
                      border: `1px solid ${isSelected ? '#bee3f8' : '#cbd5e0'}`, 
                      borderRadius: 10, 
                      padding: 16, 
                      boxShadow: isSelected ? '0 2px 8px #3182ce33' : '0 1px 4px #0001', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      position: 'relative' 
                    }} 
                    onClick={() => setSelectedStation(station)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 18, color: '#2d3748' }}>{station.name}</div>
                      {isRecommended && (
                        <span style={{ 
                          background: '#ffb703', 
                          color: '#fff', 
                          fontWeight: 700, 
                          fontSize: 13, 
                          borderRadius: 6, 
                          padding: '2px 8px', 
                          marginLeft: 4 
                        }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    
                    <div style={{ color: '#4a5568', fontSize: 15, margin: '4px 0 0 0' }}>
                      Lat: {station.lat.toFixed(5)}, Lon: {station.lon.toFixed(5)}
                    </div>
                    
                    <div style={{ color: '#3182ce', fontSize: 15, marginTop: 4 }}>
                      Distance: {(station.distance / 1000).toFixed(2)} km
                    </div>
                    
                    <div style={{ color: '#4a5568', fontSize: 14, marginTop: 4 }}>
                      {station.amenities && station.amenities.length > 0 ? (
                        <>
                          <span style={{ color: '#38a169', fontWeight: 500 }}>Amenities: </span>
                          {station.amenities.join(', ')}
                        </>
                      ) : (
                        <span style={{ color: '#a0aec0' }}>No amenities info</span>
                      )}
                    </div>
                    
                    <div style={{ color: '#805ad5', fontSize: 13, marginTop: 2 }}>
                      {station.connections !== undefined ? 
                        `${station.connections} charging point${station.connections === 1 ? '' : 's'}` : 
                        ''}
                    </div>
                    
                    {isSelected && route && (
                      <div style={{ color: '#38a169', marginTop: 6 }}>
                        Route is shown on the map
                      </div>
                    )}
                    
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDrivingMode(station);
                        }}
                        style={{
                          padding: '7px 18px',
                          borderRadius: 6,
                          background: isActive ? '#e53e3e' : '#38a169',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 15,
                          transition: 'background 0.3s'
                        }}
                      >
                        {isActive ? 'End Driving Mode' : 'Start Driving Mode'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#a0aec0', textAlign: 'center', marginTop: 32 }}>
              {fetchingStations ? 'Loading stations...' : 'No charging stations found.'}
            </div>
          )}
        </div>
      </section>
      
      <footer style={{ textAlign: 'center', color: '#a0aec0', fontSize: 14, margin: '2rem 0 1rem 0' }}>
        &copy; {new Date().getFullYear()} EV Charging Finder
      </footer>
    </main>
  );
}