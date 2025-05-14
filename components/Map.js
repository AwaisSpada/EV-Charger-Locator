import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import NorthCompass from './NorthCompass';
import L from 'leaflet';
import { useEffect } from 'react';

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

export default function Map({ userLocation, stations, onLocationSelect, selectedStation, route, onStationSelect ,activeStationId}) {
  function LocationMarker() {
    useMapEvents({
      click(e) {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      },
    });
    if (userLocation === null) return null;
    return (
      <Marker position={userLocation} icon={activeStationId ? carIcon : currentLocationIcon}>
        <Popup>{activeStationId ? 'You (Driving Mode)' : 'Your current location'}</Popup>
      </Marker>
    );
  }

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
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        {stations.map((station, idx) => (
          <Marker
            key={idx}
            position={[station.lat, station.lon]}
            icon={selectedStation && selectedStation.lat === station.lat && selectedStation.lon === station.lon ? currentLocationIcon : stationIcon}
            eventHandlers={{ click: () => onStationSelect && onStationSelect(station) }}
          >
            <Circle
              center={[station.lat, station.lon]}
              radius={3000} 
              pathOptions={{ color: 'lightblue', fillColor: '#add8e6', fillOpacity: 0.2 }}
            />
            <Popup>
              <div style={{ fontWeight: 600 }}>{station.name}</div>
              <div>Lat: {station.lat}, Lon: {station.lon}</div>
              {station.distance && <div>Distance: {(station.distance / 1000).toFixed(2)} km</div>}``
            </Popup>
          </Marker>
        ))}
        {route && <Polyline positions={route} color="#3182ce" weight={5} opacity={0.7} />}
      </MapContainer>
    </div>
  );
}

