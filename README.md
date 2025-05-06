# EV Charging Location Finder

This project is a Next.js-based web application that helps users find the nearest EV charging stations based on their current or selected location. It displays results on an interactive map using OpenStreetMap (via react-leaflet) and fetches station data from the Open Charge Map API.

## Features
- Detects your current location or allows you to select a location on the map
- Shows nearest EV charging stations on the map
- Clickable markers with station details

## Getting Started

### 1. Install dependencies
```
npm install
```

### 2. Add your Open Charge Map API key
- Create a `.env.local` file in the project root:
```
OPENCHARGEMAP_API_KEY=your_api_key_here
```
- [Get a free API key](https://openchargemap.org/site/develop/api)

### 3. Run the development server
```
npm run dev
```

### 4. Open the app
Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure
- `pages/index.js`: Main frontend page
- `pages/api/stations.js`: Backend API route for fetching stations
- `components/Map.js`: Map component (react-leaflet)

## Dependencies
- next
- react
- react-dom
- react-leaflet
- leaflet
- axios

## Notes
- This project uses OpenStreetMap tiles (free and open source)
- For production, consider adding authentication, caching, and user preferences
