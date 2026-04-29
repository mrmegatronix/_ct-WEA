/**
 * CHRISTCHURCH WEATHER DASHBOARD - PREMIUM EDITION
 */

const CHRISTCHURCH_COORDS = { lat: -43.5321, lon: 172.6362 };
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 mins
const SLIDE_INTERVAL_MS = 15000; // 15 seconds per slide

// --- SVG Icons with Animations ---
const getDefs = () => `
  <defs>
    <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD700" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>
    <linearGradient id="grad-silver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F3F4F6" />
      <stop offset="100%" stop-color="#9CA3AF" />
    </linearGradient>
  </defs>
`;

const Icons = {
    Sun: () => `
        <svg viewBox="0 0 64 64" class="animate-rotate">
            ${getDefs()}
            <circle cx="32" cy="32" r="16" fill="url(#grad-gold)" />
            ${[0,45,90,135,180,225,270,315].map(deg => `
                <rect x="30" y="4" width="4" height="10" rx="2" fill="#FFD700" transform="rotate(${deg} 32 32)" />
            `).join('')}
        </svg>
    `,
    Cloud: () => `
        <svg viewBox="0 0 64 64">
            ${getDefs()}
            <path class="animate-float" d="M46 48H18C11.37 48 6 42.63 6 36C6 29.8 10.6 24.7 16.6 24.1C17.8 15.6 25 9 33.5 9C42.8 9 50.5 15.8 52 24.8C57.6 25.9 62 30.7 62 36.5C62 42.85 56.85 48 50.5 48H46Z" fill="url(#grad-silver)" />
        </svg>
    `,
    Rain: () => `
        <svg viewBox="0 0 64 64">
            ${getDefs()}
            <path d="M46 38H18C11.37 38 6 32.63 6 26C6 19.8 10.6 14.7 16.6 14.1C17.8 5.6 25 -1 33.5 -1C42.8 -1 50.5 5.8 52 14.8C57.6 15.9 62 20.7 62 26.5C62 32.85 56.85 38 50.5 38H46Z" fill="url(#grad-silver)" />
            <g>
                <line x1="20" y1="45" x2="18" y2="55" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" class="rain-drop" style="animation-delay: 0s" />
                <line x1="32" y1="45" x2="30" y2="55" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" class="rain-drop" style="animation-delay: 0.3s" />
                <line x1="44" y1="45" x2="42" y2="55" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" class="rain-drop" style="animation-delay: 0.6s" />
            </g>
        </svg>
    `,
    Moon: () => `
        <svg viewBox="0 0 64 64">
            ${getDefs()}
            <path d="M40 10 A 24 24 0 1 0 40 54 A 18 18 0 1 1 40 10" fill="url(#grad-silver)" class="animate-float" />
        </svg>
    `,
    Nav: (deg) => `
        <svg viewBox="0 0 24 24" style="transform: rotate(${deg}deg);">
            <polygon points="12,2 22,22 12,18 2,22" fill="#D4AF37" />
        </svg>
    `
};

const getIconForCode = (code, isDay) => {
    if (code <= 1) return isDay ? Icons.Sun() : Icons.Moon();
    if (code <= 3 || (code >= 45 && code <= 48)) return Icons.Cloud();
    return Icons.Rain();
};

const getConditionText = (code) => {
    const map = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Depositing Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
        61: 'Rain', 63: 'Rain', 65: 'Heavy Rain', 71: 'Snow', 80: 'Showers',
        95: 'Stormy'
    };
    return map[code] || 'Cloudy';
};

const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase();
};

// --- Core Logic ---

async function updateWeather() {
    try {
        const params = new URLSearchParams({
            latitude: CHRISTCHURCH_COORDS.lat,
            longitude: CHRISTCHURCH_COORDS.lon,
            current: 'temperature_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
            daily: 'temperature_2m_max,temperature_2m_min,weather_code',
            timezone: 'Pacific/Auckland',
            forecast_days: 7
        });

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        const data = await res.json();

        // Update Current Slide
        document.getElementById('temp').textContent = Math.round(data.current.temperature_2m);
        document.getElementById('high').textContent = Math.round(data.daily.temperature_2m_max[0]) + '°';
        document.getElementById('low').textContent = Math.round(data.daily.temperature_2m_min[0]) + '°';
        document.getElementById('wind-speed').textContent = Math.round(data.current.wind_speed_10m);
        document.getElementById('rain').textContent = data.current.precipitation.toFixed(1);
        document.getElementById('condition-text').textContent = getConditionText(data.current.weather_code);
        
        document.getElementById('main-icon').innerHTML = getIconForCode(data.current.weather_code, data.current.is_day);
        document.getElementById('wind-icon').innerHTML = Icons.Nav(data.current.wind_direction_10m);

        // Update Forecast Slide
        const container = document.getElementById('forecast-container');
        container.innerHTML = '';
        
        data.daily.time.forEach((time, i) => {
            const card = document.createElement('div');
            card.className = 'day-card';
            card.style.animationDelay = `${i * 0.1}s`;
            card.innerHTML = `
                <div class="day-name">${getDayName(time)}</div>
                <div class="day-icon">${getIconForCode(data.daily.weather_code[i], true)}</div>
                <div class="day-temp font-heading">${Math.round(data.daily.temperature_2m_max[i])}°</div>
                <div class="day-highlow-small font-heading">LO ${Math.round(data.daily.temperature_2m_min[i])}°</div>
            `;
            container.appendChild(card);
        });

        // Update Status & Background
        document.getElementById('status').textContent = 'LIVE DATA: CHRISTCHURCH';
        document.getElementById('status').classList.add('connected');
        updateBackground(data.current.is_day);

    } catch (err) {
        console.error(err);
        document.getElementById('status').textContent = 'CONNECTION ERROR';
        document.getElementById('status').classList.remove('connected');
    }
}

function updateBackground(isDay) {
    const bg = document.getElementById('dynamic-bg');
    const stars = document.getElementById('stars');
    const hour = new Date().getHours();
    
    bg.className = '';
    stars.classList.remove('stars-visible');

    if (hour >= 6 && hour < 9) bg.classList.add('bg-sunrise');
    else if (hour >= 9 && hour < 17) bg.classList.add('bg-day');
    else if (hour >= 17 && hour < 20) bg.classList.add('bg-sunset');
    else {
        bg.classList.add('bg-night');
        stars.classList.add('stars-visible');
    }
}

// --- Slide & UI Logic ---

let currentSlideIdx = 0;
function cycleSlides() {
    const slides = document.querySelectorAll('.slide');
    slides.forEach(s => s.classList.remove('active'));
    
    currentSlideIdx = (currentSlideIdx + 1) % slides.length;
    slides[currentSlideIdx].classList.add('active');
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-NZ', { 
        hour: '2-digit', minute: '2-digit', hour12: false 
    });
}

// --- Init ---
updateClock();
updateWeather();
setInterval(updateClock, 1000);
setInterval(updateWeather, REFRESH_INTERVAL_MS);
setInterval(cycleSlides, SLIDE_INTERVAL_MS);
