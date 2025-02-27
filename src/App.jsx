import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom icons for start and destination
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Component to handle routing
function RoutingMachine({ startPoint, endPoint }) {
  const map = useMap();
  const routingControlRef = useRef(null);
  
  useEffect(() => {
    if (!startPoint || !endPoint || !map) return;
    
    // Dynamically load the Leaflet Routing Machine script
    const loadRoutingMachine = async () => {
      // Check if Routing is already available
      if (!L.Routing || !L.Routing.control) {
        // Create script element
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
        script.async = true;
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // Clean up previous routing control
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      
      // Create new routing control
      try {
        const control = L.Routing.control({
          waypoints: [
            L.latLng(startPoint.lat, startPoint.lng),
            L.latLng(endPoint.lat, endPoint.lng)
          ],
          lineOptions: {
            styles: [{ color: '#FF0000', weight: 6, opacity: 0.8 }], // Thicker, bright red line
            extendToWaypoints: true,
            missingRouteTolerance: 0
          },
          routeWhileDragging: false,
          showAlternatives: false,
          fitSelectedRoutes: true,
          show: false // Hide the text instructions
        });
        
        control.addTo(map);
        routingControlRef.current = control;
        
        // Get distance when route is calculated
        control.on('routesfound', (e) => {
          const routes = e.routes;
          const distance = routes[0].summary.totalDistance / 1000; // Convert to km
          const distanceDisplay = document.getElementById('distance-display');
          if (distanceDisplay) {
            distanceDisplay.textContent = `📏 Distance: ${distance.toFixed(2)} km`;
          }
        });
      } catch (error) {
        console.error("Error creating routing control:", error);
      }
    };
    
    loadRoutingMachine();
    
    // Cleanup function
    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
    };
  }, [map, startPoint, endPoint]);
  
  return null;
}

// Component to draw a simple line between points
function SimpleLine({ startPoint, endPoint }) {
  const map = useMap();
  const lineRef = useRef(null);
  
  useEffect(() => {
    if (!startPoint || !endPoint || !map) return;
    
    // Remove previous line if it exists
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
    }
    
    // Create a polyline with thicker, bright red styling
    const line = L.polyline(
      [
        [startPoint.lat, startPoint.lng],
        [endPoint.lat, endPoint.lng]
      ],
      { 
        color: '#FF0000', 
        weight: 6,
        opacity: 0.8,
        className: 'custom-route-line'
      }
    ).addTo(map);
    
    lineRef.current = line;
    
    // Calculate distance (straight line)
    const distance = map.distance(
      [startPoint.lat, startPoint.lng],
      [endPoint.lat, endPoint.lng]
    ) / 1000; // Convert to km
    
    const distanceDisplay = document.getElementById('distance-display');
    if (distanceDisplay) {
      distanceDisplay.textContent = `📏 Distance: ${distance.toFixed(2)} km`;
    }
    
    // Fit bounds to show both markers
    map.fitBounds([
      [startPoint.lat, startPoint.lng],
      [endPoint.lat, endPoint.lng]
    ], { padding: [50, 50] });
    
    return () => {
      if (lineRef.current) {
        map.removeLayer(lineRef.current);
        lineRef.current = null;
      }
    };
  }, [map, startPoint, endPoint]);
  
  return null;
}

function App() {
  const [startLocation, setStartLocation] = useState('');
  const [destLocation, setDestLocation] = useState('');
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // London as default
  const [zoom, setZoom] = useState(13);
  const [useSimpleLine, setUseSimpleLine] = useState(false); // Use routing by default

  // Function to geocode locations
  const geocodeLocation = async (location, isStart) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const point = { lat: parseFloat(lat), lng: parseFloat(lon) };
        
        if (isStart) {
          setStartPoint(point);
        } else {
          setEndPoint(point);
        }
        
        // Center map on first point set or midpoint between two points
        if (isStart && !endPoint) {
          setMapCenter([point.lat, point.lng]);
        } else if (!isStart && !startPoint) {
          setMapCenter([point.lat, point.lng]);
        } else if (isStart && endPoint) {
          setMapCenter([
            (point.lat + endPoint.lat) / 2,
            (point.lng + endPoint.lng) / 2
          ]);
          setZoom(5); // Zoom out to show more of the route
        } else if (!isStart && startPoint) {
          setMapCenter([
            (startPoint.lat + point.lat) / 2,
            (startPoint.lng + point.lng) / 2
          ]);
          setZoom(5); // Zoom out to show more of the route
        }
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
    }
  };

  // Handle form submission
  const handleSetLocations = (e) => {
    e.preventDefault();
    if (startLocation) geocodeLocation(startLocation, true);
    if (destLocation) geocodeLocation(destLocation, false);
  };

  // Switch locations
  const handleSwapLocations = () => {
    setStartLocation(destLocation);
    setDestLocation(startLocation);
    setStartPoint(endPoint);
    setEndPoint(startPoint);
  };

  // Handle input changes
  const handleStartLocationChange = (e) => {
    setStartLocation(e.target.value);
  };

  const handleDestLocationChange = (e) => {
    setDestLocation(e.target.value);
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="form-container">
          <h1>🌎 Search Locations</h1>
          
          <form onSubmit={handleSetLocations}>
            <div className="input-group">
              <input
                type="text"
                value={startLocation}
                onChange={handleStartLocationChange}
                placeholder="🔴 Start Location"
                required
                className="location-input"
              />
            </div>
            
            <div className="input-group">
              <input
                type="text"
                value={destLocation}
                onChange={handleDestLocationChange}
                placeholder="📍 Destination"
                required
                className="location-input"
              />
            </div>
            
            <button type="submit" className="set-btn">
              ✓ Search Locations
            </button>
            
            <button 
              type="button" 
              className="swap-btn" 
              onClick={handleSwapLocations}
            >
              ⇄ Swap Locations
            </button>
          </form>
        </div>
        
        <div id="distance-display" className="distance-display">
          📏 Distance: 0.00 km
        </div>
      </div>
      
      <div className="map-container">
        <MapContainer 
          center={mapCenter} 
          zoom={zoom} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {startPoint && (
            <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
              <Popup>Start Location</Popup>
            </Marker>
          )}
          
          {endPoint && (
            <Marker position={[endPoint.lat, endPoint.lng]} icon={destinationIcon}>
              <Popup>Destination</Popup>
            </Marker>
          )}
          
          {startPoint && endPoint && useSimpleLine && (
            <SimpleLine startPoint={startPoint} endPoint={endPoint} />
          )}
          
          {startPoint && endPoint && !useSimpleLine && (
            <RoutingMachine startPoint={startPoint} endPoint={endPoint} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
