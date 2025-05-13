import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { getDistance } from 'geolib';
import { Navigation, Navigation2, MapPin, Zap, Activity, Clock } from 'lucide-react';

const Map = dynamic(() => import('../components/Map'), { 
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder">
      <div className="loading-pulse"></div>
    </div>
  )
});

const PieChart = dynamic(() => import('../components/PieChart'), { 
  ssr: false,
  loading: () => (
    <div className="chart-loading-placeholder">
      <div className="loading-spinner"></div>
    </div>
  )
});

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
  const [showAnimation, setShowAnimation] = useState(true);
  const [mapInteractions, setMapInteractions] = useState(0);
  
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const searchInputRef = useRef(null);

  const debounceTimerRef = useRef(null);

  const getStationId = useCallback((station) => {
    return station.id || `${station.name}_${station.lat}_${station.lon}`;
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setLoading(false);
        },
        err => {
          setError('Failed to get initial location. Please ensure location services are enabled.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
    
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 1500);
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (activeStationId) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
          err => setError('Failed to track location during driving mode.'),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
        
        // Fallback for devices with inconsistent watchPosition
        locationIntervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
            null,
            { maximumAge: 5000 }
          );
        }, 10000);
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
        setMapInteractions(prev => prev + 1); 
        
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

  const handleSearchInput = useCallback((e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
    }, 300);
  }, []);

  useEffect(() => {
    const fetchStations = async () => {
      if (!userLocation) return;
      
      setFetchingStations(true);
      try {
        const res = await axios.get('/api/stations', { 
          params: { lat: userLocation[0], lon: userLocation[1] }
        });
        
        if (res.data && Array.isArray(res.data.stations)) {
          setTimeout(() => {
            setStations(res.data.stations);
            setFetchingStations(false);
          }, 300);
          
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
    setMapInteractions(prev => prev + 1); 
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
      { label: '0-5 km', min: 0, max: 5, count: 0, color: '#38bdf8' },
      { label: '5-10 km', min: 5, max: 10, count: 0, color: '#0ea5e9' },
      { label: '10-15 km', min: 10, max: 15, count: 0, color: '#0284c7' },
      { label: '15-20 km', min: 15, max: 20, count: 0, color: '#0369a1' },
      { label: '20+ km', min: 20, max: Infinity, count: 0, color: '#075985' }
    ];

    stationsWithDistance?.forEach(station => {
      const distKm = station.distance / 1000;
      if (distKm >= 0 && distKm <= 5) bins[0].count++;
      else if (distKm > 5 && distKm <= 10) bins[1].count++;
      else if (distKm > 10 && distKm <= 15) bins[2].count++;
      else if (distKm > 15 && distKm <= 20) bins[3].count++;
      else if (distKm > 20) bins[4].count++;
    });

    return bins;
  }, [stationsWithDistance]);

  const recommendedStation = useMemo(() => {
    if (stationsWithDistance.length === 0) return null;
    
    const closeStations = stationsWithDistance.filter(s => (s.distance / 1000) <= 15);
    if (closeStations.length > 0) {
      const withAmenities = closeStations.find(s => (s.amenities && s.amenities.length > 0));
      if (withAmenities) return withAmenities;
    }
    return stationsWithDistance[0];
  }, [stationsWithDistance]);

  const stationsGreaterThan10Km = useMemo(() => {
    return stationsWithDistance.filter(station => (station.distance / 1000) > 10);
  }, [stationsWithDistance]);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <main className={`ev-finder-app ${showAnimation ? 'app-entry' : ''}`}>
      <style jsx global>{`
        .ev-finder-app {
          min-height: 100vh;
          background: #f6f7fb;
          transition: opacity 0.8s ease;
        }
        
        .app-entry {
          opacity: 0;
          transform: translateY(10px);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulseSlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .map-interaction {
          animation: pulse 0.5s ease;
        }
        
        .header-container {
          animation: fadeIn 1.2s ease;
        }
        
        .station-card {
          transition: all 0.3s ease;
        }
        
        .station-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .selected-station {
          animation: pulse 1s ease;
        }
        
        .map-loading-placeholder, .chart-loading-placeholder {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 350px;
          background: #f0f4f8;
          border-radius: 12px;
        }
        
        .loading-pulse {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #3182ce;
          animation: pulse 1.5s infinite ease-in-out;
          opacity: 0.6;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(49, 130, 206, 0.3);
          border-radius: 50%;
          border-top-color: #3182ce;
          animation: spin 1s linear infinite;
        }
        
        .driving-mode-active {
          animation: pulse 2s infinite;
        }
      `}</style>
      
      <header className="header-container" style={{
        background: "#fff",
        boxShadow: "0 2px 16px rgba(0, 0, 0, 0.08)",
        padding: "0.5rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ maxWidth: 1120, margin: "auto", position: "relative", zIndex: 2 }}>
          <h1 style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "#222a35",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <span className="logo-animation" style={{ 
              marginRight: 10, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              // background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              borderRadius: "50%",
              // padding: 10,
              // boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              width: 52,
              height: 52
            }}>
              <Navigation
                size={32}
                style={{
                  color: "#2563eb",
                  animation: "pulseSlow 2s infinite"
                }}
              />
            </span>
            EV Charging Location Finder
          </h1>
          <p style={{ 
            color: "#6b7280", 
            fontSize: "1.125rem", 
            maxWidth: 600, 
            margin: "0 auto",
            animationDelay: "0.2s",
            animationFillMode: "backwards"
          }}>
            Find the nearest electric vehicle charging stations. Search by address or click on the map!
          </p>
          
          {activeStationId && (
            <div className="driving-mode-banner" style={{
              marginTop: 14,
              padding: "8px 16px",
              background: "linear-gradient(to right, #3182ce, #0284c7)",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
              animation: "slideInUp 0.5s ease"
            }}>
              <Activity size={18} />
              Driving Mode Active 
              {routeDistance && ` - ${(routeDistance / 1000).toFixed(1)} km to destination`}
            </div>
          )}
        </div>
        
        <div style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 120,
          height: 120,
          background: "linear-gradient(135deg, rgba(49, 130, 206, 0.1), rgba(49, 130, 206, 0.05))",
          borderRadius: "50%",
          zIndex: 1
        }}></div>
        <div style={{
          position: "absolute",
          bottom: -30,
          left: "10%",
          width: 80,
          height: 80,
          background: "linear-gradient(135deg, rgba(49, 130, 206, 0.08), rgba(49, 130, 206, 0.02))",
          borderRadius: "50%",
          zIndex: 1
        }}></div>
      </header>
      
      <section style={{
        maxWidth: 1200,
        margin: '2rem auto',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 24px rgba(0, 0, 0, 0.1)',
        padding: 24,
        display: 'flex',
        flexDirection: 'row',
        gap: 32,
        minHeight: 500,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        animation: 'fadeIn 1s ease',
        animationDelay: '0.3s',
        animationFillMode: 'backwards'
      }}>
        <div style={{ flex: 2, minWidth: 340, maxWidth: 700 }}>
          <form onSubmit={handleSearch} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: 16,
            animation: 'fadeIn 1s ease',
            animationDelay: '0.5s',
            animationFillMode: 'backwards'
          }} aria-label="Search for a location">
            <label htmlFor="location-search" style={{ 
              fontWeight: 500, 
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <MapPin size={18} style={{ color: '#3182ce' }} /> 
              Location:
            </label>
            <div style={{ 
              flex: 1, 
              position: 'relative',
              borderRadius: 8,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <input
                id="location-search"
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={handleSearchInput}
                placeholder="Enter address, city, or place..."
                style={{ 
                  width: '95%',
                  padding: '12px 16px', 
                  fontSize: 16, 
                  borderRadius: 8, 
                  border: '1px solid #e2e8f0',
                  transition: 'border 0.3s ease'
                }}
                aria-label="Search location"
              />
              {loading && (
                <div style={{ 
                  position: 'absolute', 
                  right: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid rgba(49, 130, 206, 0.3)',
                  borderTopColor: '#3182ce',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '12px 22px', 
                fontSize: 16, 
                borderRadius: 8, 
                background: loading ? '#90cdf4' : 'linear-gradient(to right, #3182ce, #0284c7)', 
                color: '#fff', 
                border: 'none', 
                fontWeight: 600, 
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: loading ? 'none' : '0 4px 10px rgba(49, 130, 206, 0.2)'
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          {error && (
            <div style={{ 
              marginBottom: 12, 
              color: '#e53e3e', 
              fontSize: 15, 
              padding: '10px 14px', 
              background: '#fff5f5', 
              borderRadius: 8, 
              border: '1px solid #fed7d7',
              animation: 'slideInRight 0.5s ease'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ 
            marginBottom: 12, 
            color: '#4a5568', 
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Clock size={16} />
            <span>Tip: You can also click on the map to select a location.</span>
          </div>
          
          <div style={{ minHeight: 40, marginBottom: 10 }}>
            {userLocation && stationsWithDistance.length === 0 && !fetchingStations && (
              <span style={{ 
                color: '#ed8936', 
                fontWeight: 500,
                animation: 'fadeIn 0.5s ease'
              }}>No charging stations found nearby.</span>
            )}
            {fetchingStations && (
              <span style={{ 
                color: '#3182ce', 
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%',
                  border: '2px solid rgba(49, 130, 206, 0.3)',
                  borderTopColor: '#3182ce',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
                Finding nearby stations...
              </span>
            )}
          </div>
          
          <div className={`map-container ${mapInteractions > 0 ? 'map-interaction' : ''}`} style={{ 
            borderRadius: 12, 
            overflow: 'hidden', 
            border: '1px solid #e2e8f0', 
            minHeight: 350,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <Map 
              userLocation={userLocation} 
              stations={stationsWithDistance} 
              onLocationSelect={(location) => {
                setUserLocation(location);
                setMapInteractions(prev => prev + 1);
              }}
              selectedStation={selectedStation} 
              route={route} 
              onStationSelect={(station) => {
                setSelectedStation(station);
                setMapInteractions(prev => prev + 1);
              }}
              activeStationId={activeStationId}
              getStationId={getStationId}
              drivingMode={activeStationId !== null}
            />
          </div>
          
          <div style={{ 
            marginTop: 10, 
            display: 'flex', 
            gap: 16, 
            alignItems: 'center', 
            fontSize: 14, 
            color: '#4a5568',
            flexWrap: 'wrap',
            padding: '8px 4px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                background: '#3182ce', 
                borderRadius: '50%',
                boxShadow: '0 0 0 4px rgba(49, 130, 206, 0.2)',
                animation: activeStationId ? 'pulseSlow 2s infinite' : 'none'
              }}></div>
              You{activeStationId ? ' (Driving Mode)' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                background: '#e53e3e', 
                borderRadius: '50%',
                boxShadow: '0 0 0 4px rgba(229, 62, 62, 0.15)'
              }}></div>
              Charging Station
            </span>
            {route && (
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                animation: 'fadeIn 0.5s ease'
              }}>
                <div style={{ 
                  width: 24, 
                  height: 4, 
                  background: 'linear-gradient(to right, #3182ce, #38bdf8)',
                  borderRadius: 2
                }}></div>
                Route ({(routeDistance / 1000).toFixed(1)} km)
              </span>
            )}
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          minWidth: 280, 
          maxWidth: 400, 
          height: 600, 
          overflowY: 'auto', 
          background: '#f7fafc', 
          borderRadius: 12, 
          border: '1px solid #e2e8f0', 
          padding: 16,
          animation: 'fadeIn 1s ease',
          animationDelay: '0.7s',
          animationFillMode: 'backwards'
        }}>
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <PieChart 
              data={chartData} 
              total={stationsWithDistance?.length} 
              loading={fetchingStations}
            />
          </div>

          <div style={{ 
            margin: '18px 0 16px 0', 
            padding: '14px', 
            background: 'linear-gradient(to right, #edf2f7, #f7fafc)', 
            borderRadius: 10, 
            color: '#2d3748',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            animation: 'fadeIn 0.8s ease'
          }}>
            <h4 style={{ 
              margin: 0, 
              fontSize: 16, 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Zap size={18} style={{ color: '#3182ce' }} />
              Stations &gt; 10km away
            </h4>
            {stationsGreaterThan10Km.length === 0 ? (
              <div style={{ color: '#718096', fontSize: 14, marginTop: 8 }}>
                No stations farther than 10km.
              </div>
            ) : (
              <ul style={{ 
                margin: '10px 0 0 0', 
                padding: 0, 
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                {stationsGreaterThan10Km.slice(0, 5).map((station, index) => (
                  <li key={getStationId(station)} style={{ 
                    fontSize: 15,
                    animation: `fadeIn 0.5s ease ${0.1 * index}s`,
                    animationFillMode: 'backwards',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: index % 2 === 0 ? 'rgba(237, 242, 247, 0.5)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 500 }}>{station.name || 'Unnamed Station'}</span>
                    <span style={{ 
                      color: '#4a5568', 
                      fontWeight: 500,
                      background: '#e2e8f0',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontSize: 13
                    }}>
                      {(station.distance / 1000).toFixed(1)} km
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ 
            fontWeight: 600, 
            fontSize: 20, 
            color: '#2d3748', 
            marginBottom: 14, 
            padding: '4px 0',
            borderBottom: '2px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}>
            <Zap size={20} style={{ color: '#3182ce' }} />
            Charging Stations
            {stationsWithDistance?.length > 0 && (
              <span style={{ 
                fontSize: 14, 
                fontWeight: 500, 
                background: '#3182ce', 
                color: 'white', 
                borderRadius: 12, 
                padding: '2px 8px',
                marginLeft: 4
              }}>
                {stationsWithDistance.length}
              </span>
            )}
          </div>
          
          {stationsWithDistance?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stationsWithDistance.map((station, index) => {
                const stationId = getStationId(station);
                const isActive = activeStationId === stationId;
                const isSelected = selectedStation === station;
                const isRecommended = recommendedStation === station;
                
                return (
                  <div 
                    key={stationId} 
                    className={`station-card ${isSelected ? 'selected-station' : ''}`}
                    style={{ 
                      background: isSelected ? 'linear-gradient(to right, #ebf8ff, #e6f6ff)' : '#fff', 
                      border: `1px solid ${isSelected ? '#bee3f8' : '#e2e8f0'}`, 
                      borderRadius: 12, 
                      padding: 16, 
                      boxShadow: isSelected ? '0 4px 12px rgba(49, 130, 206, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.05)', 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease', 
                      position: 'relative',
                      animation: `fadeIn 0.5s ease ${0.1 * index}s`,
                      animationFillMode: 'backwards'
                    }} 
                    onClick={() => setSelectedStation(station)}
                  >
                    {isRecommended && (
                      <div style={{
                        position: 'absolute',
                        top: -10,
                        right: 12,
                        background: 'linear-gradient(to right, #ffb703, #fd9e02)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        borderRadius: 16,
                        padding: '4px 12px',
                        boxShadow: '0 4px 6px rgba(255, 183, 3, 0.3)',
                        animation: 'pulse 2s infinite'
                      }}>
                        Recommended
                      </div>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10,
                      marginBottom: 6
                    }}>
                      <div style={{
                        background: isSelected ? '#3182ce' : '#e2e8f0',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        <Zap size={20} style={{ color: isSelected ? '#fff' : '#4a5568' }} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 18, color: '#2d3748' }}>
                        {station.name || 'Charging Station'}
                      </div>
                    </div>
                    
                    <div style={{ 
                      color: '#4a5568', 
                      fontSize: 14, 
                      margin: '6px 0 8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <MapPin size={16} style={{ color: '#718096' }} />
                      <span>
                        {station.lat.toFixed(5)}, {station.lon.toFixed(5)}
                      </span>
                    </div>
                    
                    <div style={{ 
                      fontSize: 16, 
                      fontWeight: 600,
                      margin: '12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'linear-gradient(to right, #ebf8ff, #e6f6ff)',
                      color: '#3182ce',
                      boxShadow: '0 2px 4px rgba(49, 130, 206, 0.1)'
                    }}>
                      {(station.distance / 1000).toFixed(2)} km away
                    </div>
                    
                    <div style={{ 
                      color: '#4a5568', 
                      fontSize: 14, 
                      margin: '10px 0 6px',
                      background: '#f7fafc',
                      padding: '8px 10px',
                      borderRadius: 8
                    }}>
                      {station.amenities && station.amenities.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ color: '#38a169', fontWeight: 500, marginBottom: 2 }}>
                            Available Amenities:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {station.amenities.map((amenity, i) => (
                              <span key={i} style={{
                                background: '#edf2f7',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 13,
                                color: '#4a5568'
                              }}>
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>No amenities information available</span>
                      )}
                    </div>
                    
                    <div style={{ 
                      color: '#805ad5', 
                      fontSize: 14, 
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {station.connections !== undefined ? (
                        <>
                          <Activity size={16} />
                          <span>
                            {station.connections} charging point{station.connections === 1 ? '' : 's'} available
                          </span>
                        </>
                      ) : ''}
                    </div>
                    
                    {isSelected && route && (
                      <div style={{ 
                        color: '#38a169', 
                        marginTop: 10,
                        padding: '6px 10px',
                        background: 'rgba(56, 161, 105, 0.1)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        animation: 'fadeIn 0.5s ease'
                      }}>
                        <Navigation size={16} />
                        Route is shown on the map • {(routeDistance / 1000).toFixed(1)} km
                      </div>
                    )}
                    
                    <div style={{ 
                      marginTop: 16, 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDrivingMode(station);
                        }}
                        style={{
                          padding: '10px 20px',
                          borderRadius: 8,
                          background: isActive ? 
                            'linear-gradient(to right, #e53e3e, #c53030)' : 
                            'linear-gradient(to right, #38a169, #2f855a)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 15,
                          transition: 'all 0.3s ease',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: isActive ? 
                            '0 4px 10px rgba(229, 62, 62, 0.25)' : 
                            '0 4px 10px rgba(56, 161, 105, 0.25)'
                        }}
                      >
                        <Navigation size={16} />
                        {isActive ? 'End Driving Mode' : 'Start Driving Mode'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              color: '#a0aec0', 
              textAlign: 'center', 
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              padding: '40px 20px'
            }}>
              {fetchingStations ? (
                <>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%',
                    border: '3px solid rgba(49, 130, 206, 0.2)',
                    borderTopColor: '#3182ce',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <div>Loading charging stations...</div>
                </>
              ) : (
                <>
                  <div style={{
                    background: '#edf2f7',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Zap size={30} style={{ color: '#a0aec0' }} />
                  </div>
                  <div>No charging stations found in this area.</div>
                  <div style={{ fontSize: 14, maxWidth: 240 }}>Try searching for a different location or zooming out on the map.</div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
      
      <footer style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#a0aec0', 
        fontSize: 14, 
        padding: '2rem 0 1.5rem 0',
        gap: 10,
        animation: 'fadeIn 1s ease',
        animationDelay: '1s',
        animationFillMode: 'backwards'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          padding: '8px 16px',
          borderRadius: 20,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.3s ease'
        }}
        className="footer-brand"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
        }}
        >
          <Navigation2 size={18} style={{
            color: "#3182ce",
            animation: "pulseSlow 2s infinite"
          }} />
          &copy; {new Date().getFullYear()} EV Charging Finder
        </div>
      </footer>
    </main>
  );
}