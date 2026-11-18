
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const tempUnitToggle = document.getElementById('temp-unit-toggle');
    const favoritesButton = document.getElementById('favorites-button');
    const welcomeScreen = document.getElementById('welcome-screen');
    const weatherContent = document.getElementById('weather-content');
    const errorScreen = document.getElementById('error-screen');
    const suggestedCitiesContainer = document.getElementById('suggested-cities');
    const currentTWeather = document.getElementById('current-weather');
    const hourlyTForecast = document.getElementById('hourly-forecast');
    const dailyTForecast = document.getElementById('daily-forecast');
    const favoritesSidebar = document.getElementById('favorites-sidebar');
    const favoritesList = document.getElementById('favorites-list');
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const toast = document.getElementById('toast');

    let state = {
        currentCity: null,
        favorites: JSON.parse(localStorage.getItem('weatherAppFavorites')) || [],
        tempUnit: localStorage.getItem('weatherAppTempUnit') || 'celsius',
        debounceTimer: null
    };

    const WMO_MAP = {
        0: {desc: "Ciel dégagé", icon: "☀️"},
        1: {desc: "Plutôt dégagé", icon: "🌤️"},
        2: {desc: "Partiellement nuageux", icon: "⛅"},
        3: {desc: "Couvert", icon: "☁️"},
        45: {desc: "Brouillard", icon: "🌫️"},
        48: {desc: "Brouillard givrant", icon: "🌫️"},
        51: {desc: "Bruine légère", icon: "🌧️"},
        53: {desc: "Bruine modérée", icon: "🌧️"},
        55: {desc: "Bruine forte", icon: "🌧️"},
        56: {desc: "Bruine verglaçante légère", icon: "🌧️❄️"},
        57: {desc: "Bruine verglaçante forte", icon: "🌧️❄️"},
        61: {desc: "Pluie légère", icon: "🌧️"},
        63: {desc: "Pluie modérée", icon: "🌧️"},
        65: {desc: "Pluie forte", icon: "🌧️"},
        66: {desc: "Pluie verglaçante légère", icon: "🌧️❄️"},
        67: {desc: "Pluie verglaçante forte", icon: "🌧️❄️"},
        71: {desc: "Neige légère", icon: "❄️"},
        73: {desc: "Neige modérée", icon: "❄️"},
        75: {desc: "Neige forte", icon: "❄️"},
        77: {desc: "Grains de neige", icon: "❄️"},
        80: {desc: "Averses légères", icon: "🌧️"},
        81: {desc: "Averses modérées", icon: "🌧️"},
        82: {desc: "Averses violentes", icon: "🌧️"},
        85: {desc: "Averses de neige légères", icon: "❄️🌧️"},
        86: {desc: "Averses de neige fortes", icon: "❄️🌧️"},
        95: {desc: "Orage", icon: "⛈️"},
        96: {desc: "Orage avec grêle légère", icon: "⛈️"},
        99: {desc: "Orage avec grêle forte", icon: "⛈️"},
    };

    const AQI_MAP = {
        1: { text: "Bon", color: "bg-green-500" },
        2: { text: "Moyen", color: "bg-yellow-500" },
        3: { text: "Dégradé", color: "bg-orange-500" },
        4: { text: "Mauvais", color: "bg-red-500" },
        5: { text: "Très mauvais", color: "bg-purple-500" },
        6: { text: "Extrêmement mauvais", color: "bg-red-800" },
    };
    
    // INIT
    function init() {
        tempUnitToggle.checked = state.tempUnit === 'fahrenheit';
        updateFavoritesList();
        const lastCity = JSON.parse(localStorage.getItem('weatherAppLastCity'));
        if (lastCity) {
            fetchWeather(lastCity);
        } else if (state.favorites.length > 0) {
            fetchWeather(state.favorites[0]);
        } else {
            showWelcomeScreen();
        }

        searchInput.addEventListener('input', onSearchInput);
        tempUnitToggle.addEventListener('change', onTempUnitChange);
        favoritesButton.addEventListener('click', toggleFavorite);
        document.addEventListener('click', (e) => {
            if (!searchSuggestions.contains(e.target)) {
                searchSuggestions.classList.add('hidden');
            }
            if(e.target === modal){
                closeModal();
            }
        });
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape') {
                searchSuggestions.classList.add('hidden');
                closeModal();
            }
        })
    }

    function showWelcomeScreen() {
        weatherContent.classList.add('hidden');
        errorScreen.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        const suggestedCities = [
            { name: "Paris", lat: 48.8566, lon: 2.3522, country: "France" },
            { name: "New York", lat: 40.7128, lon: -74.0060, country: "USA" },
            { name: "Tokyo", lat: 35.6895, lon: 139.6917, country: "Japan" },
            { name: "London", lat: 51.5074, lon: -0.1278, country: "UK" },
            { name: "Sydney", lat: -33.8688, lon: 151.2093, country: "Australia" },
        ];
        suggestedCitiesContainer.innerHTML = suggestedCities.map(city => 
            `<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" data-lat="${city.lat}" data-lon="${city.lon}" data-name="${city.name}">${city.name}</button>`
        ).join('');
        suggestedCitiesContainer.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { lat, lon, name } = e.target.dataset;
                fetchWeather({ name, lat: parseFloat(lat), lon: parseFloat(lon) });
            });
        });
    }

    // SEARCH
    function onSearchInput(e) {
        clearTimeout(state.debounceTimer);
        const query = e.target.value;
        if (query.length < 2) {
            searchSuggestions.classList.add('hidden');
            return;
        }
        state.debounceTimer = setTimeout(() => {
            fetchCitySuggestions(query);
        }, 300);
    }

    async function fetchCitySuggestions(query) {
        searchSuggestions.classList.remove('hidden');
        searchSuggestions.innerHTML = `<div class="p-2">Recherche en cours...</div>`;
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=6&language=fr&format=json`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                renderSuggestions(data.results);
            } else {
                searchSuggestions.innerHTML = `<div class="p-2">Aucune ville trouvée</div>`;
            }
        } catch (error) {
            searchSuggestions.innerHTML = `<div class="p-2">Erreur de recherche</div>`;
        }
    }

    function renderSuggestions(cities) {
        searchSuggestions.innerHTML = cities.map(city =>
            `<div class="p-2 cursor-pointer hover:bg-gray-700" data-lat="${city.latitude}" data-lon="${city.longitude}" data-name="${city.name}">
                ${city.name}, ${city.admin1 || ''} ${city.country}
            </div>`
        ).join('');
        searchSuggestions.querySelectorAll('div').forEach(div => {
            div.addEventListener('click', (e) => {
                const { lat, lon, name } = e.currentTarget.dataset;
                fetchWeather({ name, lat: parseFloat(lat), lon: parseFloat(lon) });
                searchInput.value = '';
                searchSuggestions.classList.add('hidden');
            });
        });
    }

    // WEATHER
    async function fetchWeather(city) {
        welcomeScreen.classList.add('hidden');
        errorScreen.classList.add('hidden');
        weatherContent.classList.remove('hidden');
        currentTWeather.innerHTML = 'Chargement...';
        
        try {
            const { lat, lon } = city;
            const tempUnit = state.tempUnit;

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&hourly=temperature_2m,weather_code,uv_index,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset&temperature_unit=${tempUnit}&wind_speed_unit=kmh&timezone=auto&forecast_days=7`;
            const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=auto`;

            const [weatherRes, airQualityRes] = await Promise.all([fetch(weatherUrl), fetch(airQualityUrl)]);
            if (!weatherRes.ok) throw new Error('Failed to fetch weather data');
            
            const weatherData = await weatherRes.json();
            let airQualityData = null;
            if(airQualityRes.ok){
                airQualityData = await airQualityRes.json();
            }

            state.currentCity = { ...city, weatherData, airQualityData };
            localStorage.setItem('weatherAppLastCity', JSON.stringify({name: city.name, lat: city.lat, lon: city.lon}));
            renderAll();

        } catch (error) {
            console.error(error);
            showErrorScreen();
            showToast('Erreur de chargement des données', 'error');
        }
    }
    
    function showErrorScreen(){
        welcomeScreen.classList.add('hidden');
        weatherContent.classList.add('hidden');
        errorScreen.classList.remove('hidden');
    }

    // RENDER
    function renderAll() {
        if (!state.currentCity) return;
        renderCurrentWeather();
        renderHourlyForecast();
        renderDailyForecast();
        updateFavoritesButton();
    }

    function renderCurrentWeather() {
        const { name, weatherData, airQualityData } = state.currentCity;
        const { current } = weatherData;
        const weatherInfo = WMO_MAP[current.weather_code] || {desc: 'Inconnu', icon: '❓'};
        const aqi = airQualityData?.current?.european_aqi;
        const aqiInfo = aqi ? AQI_MAP[Math.round(aqi/20)] || AQI_MAP[6] : { text: "N/A", color: "bg-gray-500" };

        currentTWeather.innerHTML = `
            <h2 class="text-2xl font-bold">${name}</h2>
            <div class="flex items-center text-5xl">
                <span class="mr-4">${weatherInfo.icon}</span>
                <span>${Math.round(current.temperature_2m)}${getTempUnit()}</span>
            </div>
            <p>${weatherInfo.desc}</p>
            <p>Ressenti: ${Math.round(current.apparent_temperature)}${getTempUnit()}</p>
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div>Humidité: ${current.relative_humidity_2m}%</div>
                <div>Vent: ${current.wind_speed_10m} km/h</div>
                <div>Indice UV: ${weatherData.daily.uv_index_max[0]}</div>
                <div>
                    Qualité de l'air: <span class="px-2 py-1 text-sm font-bold text-white rounded ${aqiInfo.color}">${aqiInfo.text}</span>
                </div>
                <div>Lever du soleil: ${new Date(weatherData.daily.sunrise[0]).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</div>
                <div>Coucher du soleil: ${new Date(weatherData.daily.sunset[0]).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</div>
            </div>
        `;
    }

    function renderHourlyForecast() {
        const { weatherData } = state.currentCity;
        const { hourly, current } = weatherData;
        
        const now = new Date(current.time + 'Z'); // Interpret as UTC
        const timezone = weatherData.timezone;
        
        // Find the index of the current hour
        let currentHourIndex = hourly.time.findIndex(t => new Date(t + 'Z') >= now);
        if(currentHourIndex === -1) currentHourIndex = 0;

        let hourlyHtml = '<div class="overflow-x-auto whitespace-nowrap">';
        for (let i = currentHourIndex; i < currentHourIndex + 24 && i < hourly.time.length; i++) {
            const time = new Date(hourly.time[i] + 'Z');
            const weatherInfo = WMO_MAP[hourly.weather_code[i]] || {desc: '', icon: '❓'};
            
            const isCurrent = i === currentHourIndex;
            const hourLabel = isCurrent ? "Maintenant" : time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
            
            hourlyHtml += `
                <div class="inline-block text-center p-2 cursor-pointer ${isCurrent ? 'border border-blue-500 rounded-lg' : ''}"
                    data-index="${i}">
                    <div>${hourLabel}</div>
                    <div class="text-2xl">${weatherInfo.icon}</div>
                    <div>${Math.round(hourly.temperature_2m[i])}${getTempUnit()}</div>
                </div>
            `;
        }
        hourlyHtml += '</div>';
        hourlyTForecast.innerHTML = `
            <h3 class="text-xl font-bold mb-4">Prévisions 24 heures</h3>
            ${hourlyHtml}
        `;

        hourlyTForecast.querySelectorAll('[data-index]').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                const index = e.currentTarget.dataset.index;
                showHourlyDetailModal(index);
            });
        });
    }

    function renderDailyForecast() {
        const { weatherData } = state.currentCity;
        const { daily } = weatherData;
        let dailyHtml = '';
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i] + 'T00:00:00'); // Ensure date is parsed correctly
            const dayLabel = i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : date.toLocaleDateString('fr-FR', { weekday: 'long' });
            const weatherInfo = WMO_MAP[daily.weather_code[i]] || {desc: '', icon: '❓'};
            dailyHtml += `
                <div class="flex justify-between items-center p-2 hover:bg-gray-700 rounded-lg cursor-pointer" data-index="${i}">
                    <span>${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}</span>
                    <span class="text-2xl">${weatherInfo.icon}</span>
                    <span>${Math.round(daily.temperature_2m_max[i])}${getTempUnit()} / ${Math.round(daily.temperature_2m_min[i])}${getTempUnit()}</span>
                </div>
            `;
        }
        dailyTForecast.innerHTML = `
            <h3 class="text-xl font-bold mb-4">Prévisions 7 jours</h3>
            ${dailyHtml}
        `;

        dailyTForecast.querySelectorAll('[data-index]').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                const index = e.currentTarget.dataset.index;
                showDailyDetailModal(index);
            });
        });
    }

    // FAVORITES
    function toggleFavorite() {
        if (!state.currentCity) return;

        const city = { name: state.currentCity.name, lat: state.currentCity.lat, lon: state.currentCity.lon };
        const index = findFavoriteIndex(city);

        if (index > -1) {
            state.favorites.splice(index, 1);
            showToast('Favori supprimé', 'info');
        } else {
            state.favorites.push(city);
            showToast('Favori ajouté', 'info');
        }
        
        saveFavorites();
        updateFavoritesList();
        updateFavoritesButton();
    }
    
    function findFavoriteIndex(city) {
        return state.favorites.findIndex(fav => 
            Math.abs(parseFloat(fav.lat) - parseFloat(city.lat)) < 0.0001 &&
            Math.abs(parseFloat(fav.lon) - parseFloat(city.lon)) < 0.0001
        );
    }
    
    function saveFavorites(){
        localStorage.setItem('weatherAppFavorites', JSON.stringify(state.favorites));
    }

    function updateFavoritesList() {
        favoritesList.innerHTML = state.favorites.map(fav =>
            `<div class="flex justify-between items-center p-2 hover:bg-gray-700 rounded-lg cursor-pointer" data-lat="${fav.lat}" data-lon="${fav.lon}" data-name="${fav.name}">
                <span>${fav.name}</span>
                <button class="delete-fav-btn text-red-500 hover:text-red-700" data-lat="${fav.lat}" data-lon="${fav.lon}">🗑️</button>
            </div>`
        ).join('');
        
        favoritesList.querySelectorAll('.delete-fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const { lat, lon } = e.target.dataset;
                const index = findFavoriteIndex({ lat, lon });
                if(index > -1){
                    state.favorites.splice(index, 1);
                    saveFavorites();
                    updateFavoritesList();
                    updateFavoritesButton();
                    showToast('Favori supprimé', 'info');
                }
            });
        });
        
        favoritesList.querySelectorAll('div[data-name]').forEach(el => {
            el.addEventListener('click', (e) => {
                if(e.target.classList.contains('delete-fav-btn')) return;
                const { lat, lon, name } = e.currentTarget.dataset;
                fetchWeather({ name, lat: parseFloat(lat), lon: parseFloat(lon) });
            })
        });

    }

    function updateFavoritesButton() {
        if (!state.currentCity) return;
        const index = findFavoriteIndex(state.currentCity);
        if (index > -1) {
            favoritesButton.classList.add('text-yellow-400');
        } else {
            favoritesButton.classList.remove('text-yellow-400');
        }
    }

    // MODAL
    function showHourlyDetailModal(index) {
        const { weatherData } = state.currentCity;
        const { hourly } = weatherData;
        const weatherInfo = WMO_MAP[hourly.weather_code[index]] || {desc: '', icon: '❓'};
        const time = new Date(hourly.time[index] + 'Z').toLocaleTimeString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: weatherData.timezone });
        
        modalContent.innerHTML = `
            <h3 class="text-xl font-bold mb-4">Détail Horaire - ${time}</h3>
            <p>Température: ${Math.round(hourly.temperature_2m[index])}${getTempUnit()}</p>
            <p>Condition: ${weatherInfo.icon} ${weatherInfo.desc}</p>
            <p>Humidité: ${hourly.relative_humidity_2m[index]}%</p>
            <p>Vent: ${hourly.wind_speed_10m[index]} km/h</p>
            <p>Indice UV: ${hourly.uv_index[index]}</p>
            <button id="close-modal" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Fermer</button>
        `;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('close-modal').addEventListener('click', closeModal);
    }
    
    function showDailyDetailModal(index) {
        const { weatherData } = state.currentCity;
        const { daily } = weatherData;
        const weatherInfo = WMO_MAP[daily.weather_code[index]] || {desc: '', icon: '❓'};
        const date = new Date(daily.time[index] + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        modalContent.innerHTML = `
            <h3 class="text-xl font-bold mb-4">Détail Journalier - ${date}</h3>
            <p>Températures: ${Math.round(daily.temperature_2m_max[index])}${getTempUnit()} / ${Math.round(daily.temperature_2m_min[index])}${getTempUnit()}</p>
            <p>Condition: ${weatherInfo.icon} ${weatherInfo.desc}</p>
            <p>Indice UV max: ${daily.uv_index_max[index]}</p>
            <p>Lever du soleil: ${new Date(daily.sunrise[index]).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</p>
            <p>Coucher du soleil: ${new Date(daily.sunset[index]).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</p>
            <button id="close-modal" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Fermer</button>
        `;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('close-modal').addEventListener('click', closeModal);
    }
    
    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // UTILS
    function onTempUnitChange() {
        state.tempUnit = tempUnitToggle.checked ? 'fahrenheit' : 'celsius';
        localStorage.setItem('weatherAppTempUnit', state.tempUnit);
        if (state.currentCity) {
            fetchWeather(state.currentCity); // Refetch to get correct units
        }
    }

    function getTempUnit() {
        return state.tempUnit === 'celsius' ? '°C' : '°F';
    }

    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = 'fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg';
        if (type === 'error') {
            toast.classList.add('bg-red-500');
        } else {
            toast.classList.add('bg-blue-500');
        }
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    init();
});
