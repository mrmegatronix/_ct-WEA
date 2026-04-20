/**
 * CHRISTCHURCH WEATHER DASHBOARD - FRESH & SIMPLE (Vanilla)
 */

const CHRISTCHURCH_COORDS = { lat: -43.5321, lon: 172.6362 };
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// SVG Icons
const getDefs = () => `
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD700" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>
    <linearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F3F4F6" />
      <stop offset="100%" stop-color="#9CA3AF" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
`;

const Icons = {
    Sun: () => `<svg viewBox="0 0 64 64">${getDefs()}<circle cx="32" cy="32" r="20" fill="url(#gold)" filter="url(#glow)" /></svg>`,
    Moon: () => `<svg viewBox="0 0 64 64">${getDefs()}<path d="M40 10 A 24 24 0 1 0 40 54 A 18 18 0 1 1 40 10" fill="url(#silver)" filter="url(#glow)"/></svg>`,
    Cloud: () => `<svg viewBox="0 0 64 64">${getDefs()}<path d="M46 48H18C11.37 48 6 42.63 6 36C6 29.8 10.6 24.7 16.6 24.1C17.8 15.6 25 9 33.5 9C42.8 9 50.5 15.8 52 24.8C57.6 25.9 62 30.7 62 36.5C62 42.85 56.85 48 50.5 48H46Z" fill="url(#silver)" opacity="0.9" /></svg>`,
    Rain: () => `<svg viewBox="0 0 64 64">${getDefs()}<path d="M46 38H18C11.37 38 6 32.63 6 26C6 19.8 10.6 14.7 16.6 14.1C17.8 5.6 25 -1 33.5 -1C42.8 -1 50.5 5.8 52 14.8C57.6 15.9 62 20.7 62 26.5C62 32.85 56.85 38 50.5 38H46Z" fill="url(#silver)" /><path d="M22 42L18 52 M32 42L28 52 M42 42L38 52" stroke="#60A5FA" stroke-width="3" stroke-linecap="round"/></svg>`,
    Nav: (deg) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="nav-icon" style="transform: rotate(${deg}deg); color: #D4AF37;">
        <polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor"/>
    </svg>`
};

const getWeatherIcon = (code, isDay) => {
    if (code === 0 || code === 1) return isDay ? Icons.Sun() : Icons.Moon();
    if (code === 2 || code === 3 || (code >= 45 && code <= 48)) return Icons.Cloud();
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return Icons.Rain();
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return Icons.Cloud(); // Simpified Snow
    if (code >= 95) return Icons.Rain(); // Simplified Thunder
    return Icons.Cloud();
};

const getWindDirection = (degrees) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(degrees / 45) % 8];
};

async function fetchWeather() {
    const params = new URLSearchParams({
        latitude: CHRISTCHURCH_COORDS.lat,
        longitude: CHRISTCHURCH_COORDS.lon,
        current: 'temperature_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
        daily: 'temperature_2m_max,temperature_2m_min',
        timezone: 'Pacific/Auckland',
        forecast_days: 1
    });

    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params.toString());
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        // Update DOM
        document.getElementById('temp').textContent = Math.round(data.current.temperature_2m);
        document.getElementById('high').textContent = Math.round(data.daily.temperature_2m_max[0]);
        document.getElementById('low').textContent = Math.round(data.daily.temperature_2m_min[0]);
        document.getElementById('wind-speed').textContent = Math.round(data.current.wind_speed_10m);
        document.getElementById('wind-dir').textContent = getWindDirection(data.current.wind_direction_10m);
        document.getElementById('rain').textContent = data.current.precipitation.toFixed(1);
        
        document.getElementById('main-icon').innerHTML = getWeatherIcon(data.current.weather_code, data.current.is_day);
        document.getElementById('wind-icon').innerHTML = Icons.Nav(data.current.wind_direction_10m);
        
        document.getElementById('status').textContent = 'CONNECTED';
        document.getElementById('status').className = 'status connected';
    } catch (e) {
        document.getElementById('status').textContent = 'OFFLINE';
        document.getElementById('status').className = 'status offline';
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Init
setInterval(updateClock, 1000);
setInterval(fetchWeather, REFRESH_INTERVAL_MS);
updateClock();
fetchWeather();
