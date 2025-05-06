import { MapContainer, TileLayer, Marker, Popup, useMapEvents,useMap } from 'react-leaflet';
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

export default function Map({ userLocation, stations, onLocationSelect }) {
  function LocationMarker() {
    useMapEvents({
      click(e) {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      },
    });
    return userLocation === null ? null : (
      <Marker position={userLocation} icon={currentLocationIcon}>
        <Popup>Your current location</Popup>
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
      <MapContainer center={userLocation || [51.505, -0.09]} zoom={13} style={{ height: '60vh', minHeight: 350, width: '100%' }}>
        <MapAutoPan userLocation={userLocation} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        {stations.map((station, idx) => (
          <Marker key={idx} position={[station.lat, station.lon]} icon={stationIcon}>
            <Popup>{station.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

