import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import NorthCompass from './NorthCompass';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// WeatherInfo component to display weather data
const WeatherInfo = ({ weatherData, title, compact = false }) => {
  if (!weatherData) return <div>Loading weather data...</div>;
  
  return (
    <div>
      {title && <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{title}</div>}
      <div style={{ minWidth: compact ? '180px' : '200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: compact ? '4px' : '8px' }}>
          <img 
            src={`https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`} 
            alt="Weather icon" 
            style={{ width: compact ? '40px' : '50px', height: compact ? '40px' : '50px' }}
          />
          <div>
            <div style={{ fontSize: compact ? '1.2rem' : '1.5rem', fontWeight: 'bold' }}>
              {Math.round(weatherData.temp)}°C
            </div>
            <div style={{ textTransform: 'capitalize', fontSize: compact ? '0.9em' : '1em' }}>
              {weatherData.description}
            </div>
          </div>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr', 
          gap: compact ? '2px 8px' : '4px',
          fontSize: compact ? '0.85em' : '0.9em'
        }}>
          <div>Feels like:</div>
          <div>{Math.round(weatherData.feels_like)}°C</div>
          <div>Humidity:</div>
          <div>{weatherData.humidity}%</div>
          <div>Wind:</div>
          <div>{weatherData.wind_speed} m/s</div>
          {!compact && (
            <>
              <div>Min/Max:</div>
              <div>{Math.round(weatherData.temp_min)}° / {Math.round(weatherData.temp_max)}°</div>
              <div>Pressure:</div>
              <div>{weatherData.pressure} hPa</div>
            </>
          )}
        </div>
        {!compact && weatherData.city && (
          <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666' }}>
            {weatherData.city}, {weatherData.country}
          </div>
        )}
      </div>
    </div>
  );
};

const currentLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});
const stationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
function MapAutoPan({ userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.setView(userLocation, map.getZoom(), { animate: true });
    }
  }, [userLocation]);
  return null;
}

async function fetchWeather(lat, lon) {
  try {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}&units=metric`;
    console.log('Fetching weather from:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('Weather API response:', data);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Return all weather data
    return {
      temp: data.main?.temp,
      feels_like: data.main?.feels_like,
      temp_min: data.main?.temp_min,
      temp_max: data.main?.temp_max,
      pressure: data.main?.pressure,
      humidity: data.main?.humidity,
      description: data.weather?.[0]?.description,
      icon: data.weather?.[0]?.icon,
      wind_speed: data.wind?.speed,
      wind_deg: data.wind?.deg,
      city: data.name,
      country: data.sys?.country,
      sunrise: data.sys?.sunrise,
      sunset: data.sys?.sunset,
      timezone: data.timezone
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

export default function Map({ userLocation, stations, onLocationSelect, selectedStation, route, onStationSelect, activeStationId }) {
  const [weatherData, setWeatherData] = useState({});

  // Fetch weather for user location
  useEffect(() => {
    if (userLocation) {
      fetchWeather(userLocation[0], userLocation[1])
        .then(data => {
          if (data) setWeatherData(prev => ({
            ...prev,
            userLocation: { ...data, id: 'userLocation' }
          }));
        });
    }
  }, [userLocation]);
  
  // Fetch weather for stations
  useEffect(() => {
    if (stations && stations.length > 0) {
      stations.forEach(station => {
        fetchWeather(station.lat, station.lon)
          .then(data => {
            if (data) setWeatherData(prev => ({
              ...prev,
              [station.id]: { ...data, id: station.id }
            }));
          });
      });
    }
  }, [stations]);
  function LocationMarker() {
    useMapEvents({
      click(e) {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      },
    });
    if (userLocation === null) return null;
    return (
      <Marker 
        position={userLocation} 
        icon={activeStationId ? carIcon : currentLocationIcon}
        eventHandlers={{
          click: () => {
            onLocationSelect && onLocationSelect(userLocation);
          }
        }}
      >
        <Popup>
          <WeatherInfo 
            weatherData={weatherData.userLocation} 
            title={activeStationId ? 'You (Driving Mode)' : 'Your current location'}
          />
        </Popup>
      </Marker>
    );
  }
console.log('weatherData', weatherData)
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  return (
    <div style={{ width: '100%', minHeight: 400, position: 'relative', marginBottom: 10 }} aria-label="Map showing your location and nearby charging stations">
      <NorthCompass />
      <MapContainer
        center={userLocation || [51.505, -0.09]}
        zoom={13}
        style={{ height: '70vh', minHeight: 350, width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapAutoPan userLocation={userLocation} />
        <TileLayer
          // attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        {stations.map((station, idx) => {
          const stationWeather = weatherData[station.id];
          return (
            <Marker
              key={idx}
              position={[station.lat, station.lon]}
              icon={selectedStation && selectedStation.lat === station.lat && selectedStation.lon === station.lon ? currentLocationIcon : stationIcon}
              eventHandlers={{ 
                click: () => onStationSelect && onStationSelect(station),
                popupopen: () => {
                  if (!stationWeather) {
                    fetchWeather(station.lat, station.lon)
                      .then(data => {
                        if (data) setWeatherData(prev => ({
                          ...prev,
                          [station.id]: { ...data, id: station.id }
                        }));
                      });
                  }
                }
              }}
            >
              {(!userLocation || 
                !station.distance || 
                station.distance > 2000) && (
                <Circle
                  center={[station.lat, station.lon]}
                  radius={2000} 
                  pathOptions={{ 
                    color: 'lightblue', 
                    fillColor: '#add8e6', 
                    fillOpacity: station.distance 
                      ? Math.min(0.2, Math.max(0, (station.distance / 1000 - 3) * 0.1))
                      : 0.02
                  }}
                />
              )}
              <Popup>
                <div style={{ minWidth: '220px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>{station.name}</div>
                  <div style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
                    Distance: {station.distance ? `${(station.distance / 1000).toFixed(1)} km` : 'N/A'}
                  </div>
                  {stationWeather ? (
                    <WeatherInfo 
                      weatherData={stationWeather} 
                      title="Current Weather"
                      compact={true}
                    />
                  ) : (
                    <div style={{ fontStyle: 'italic', color: '#666' }}>Loading weather data...</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {route && <Polyline positions={route} color="#3182ce" weight={5} opacity={0.7} />}
      </MapContainer>
    </div>
  );
}

