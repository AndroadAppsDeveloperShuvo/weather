import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Wind, 
  Droplets, 
  Thermometer, 
  Clock, 
  Calendar,
  RefreshCw,
  AlertCircle,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { fetchWeather, WeatherData, getWeatherDescription } from './services/weather';
import { WeatherIcon } from './components/WeatherIcon';

const LocationFetcher = ({ onLocationFound }: { onLocationFound: (lat: number, lng: number, address: string) => void }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Using OpenStreetMap Nominatim for free Reverse Geocoding
          // Added a timeout and better error handling
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: {
              'Accept-Language': 'bn',
              'User-Agent': 'WeatherApp/1.0' // Recommendations for Nominatim
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error('Network response was not ok');
          
          const data = await response.json();
          
          if (data && data.address) {
            const addr = data.address;
            // Try to find the most specific location part
            const locationName = addr.village || addr.suburb || addr.town || addr.city_district || addr.road || addr.county || addr.state || 'আমার লোকেশন';
            const district = addr.state_district || addr.city || addr.state || '';
            const fullLabel = `${locationName}${district && district !== locationName ? ', ' + district : ''}`;
            onLocationFound(latitude, longitude, fullLabel);
          } else {
            onLocationFound(latitude, longitude, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (err) {
          console.warn('Geocoding service unavailable or failed:', err);
          // Fallback to coordinates if geocoding fails
          onLocationFound(latitude, longitude, `অক্ষাংশ: ${latitude.toFixed(2)}, দ্রাঘিমাংশ: ${longitude.toFixed(2)}`);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('আপনার ডিভাইসের লোকেশন পাওয়া যাচ্ছে না। অনুগ্রহ করে লোকেশন পারমিশন দিন এবং GPS অন করুন।');
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, [onLocationFound]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-500/10 rounded-3xl border border-red-500/20 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-200 font-medium">{error}</p>
        <button 
          onClick={fetchLocation}
          className="mt-4 px-6 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  return null;
};

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const getInsight = useCallback(async (weatherData: WeatherData, addr: string) => {
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather: weatherData, location: addr })
      });
      
      if (res.ok) {
        const data = await res.json();
        setInsight(data.insight);
      } else {
        setInsight(getFallbackAdvice(weatherData.current.weatherCode, weatherData.current.temp));
      }
    } catch (e) {
      console.warn('AI insight skipped - running in static mode');
      setInsight(getFallbackAdvice(weatherData.current.weatherCode, weatherData.current.temp));
    }
  }, []);

  const getFallbackAdvice = (code: number, temp: number): string => {
    if (temp > 33) return "অতিরিক্ত গরম! শেডে পর্যাপ্ত বাতাস চলাচলের ব্যবস্থা করুন এবং পানির সাথে ইলেকট্রোলাইট দিন।";
    if (temp < 18) return "শীতল আবহাওয়া, শেডে পর্দার ব্যবস্থা রাখুন এবং ব্রুডিং তাপমাত্রা পর্যবেক্ষণ করুন।";
    if (code >= 60) return "বৃষ্টির সম্ভাবনা, শেডের ভেতর আর্দ্রতা বাড়তে পারে। পর্দা ও লিটার শুকনা রাখুন।";
    return "আবহাওয়া স্বাভাবিক। মুরগির শেডে পর্যাপ্ত আলো ও বিশুদ্ধ পানি নিশ্চিত করুন।";
  };

  const handleLocationFound = useCallback(async (lat: number, lng: number, address: string) => {
    // Only update if location changed significantly or not set
    setLocation(prev => {
      if (prev && Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001) return prev;
      return { lat, lng, address };
    });
    
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lng);
      setWeather(data);
      getInsight(data, address);
    } catch (e) {
      console.error(e);
      setError('আবহাওয়ার তথ্য পাওয়া যায়নি।');
    } finally {
      setLoading(false);
    }
  }, [getInsight]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`, {
        headers: { 'Accept-Language': 'bn', 'User-Agent': 'WeatherApp/1.0' }
      });
      const data = await response.json();
      if (data && data[0]) {
        const item = data[0];
        const addr = item.address;
        const locationName = addr.village || addr.suburb || addr.town || addr.city_district || addr.road || addr.county || addr.state || item.display_name;
        const district = addr.state_district || addr.city || '';
        const fullLabel = `${locationName}${district ? ', ' + district : ''}`;
        handleLocationFound(parseFloat(item.lat), parseFloat(item.lon), fullLabel);
      } else {
        alert('দুঃখিত, ওই জায়গাটি খুঁজে পাওয়া যায়নি।');
      }
    } catch (err) {
      console.error(err);
      alert('লোকেশন খুঁজতে সমস্যা হচ্ছে।');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-1000 overflow-x-hidden p-4 md:p-8 flex flex-col items-center",
      weather?.current.isDay ? "bg-sky-400" : "bg-indigo-950"
    )}>
      {/* Dynamic Background Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-40">
         <div className={cn(
           "absolute top-[-10%] left-[-10%] w-[120%] h-[120%] blur-[120px]",
           weather?.current.isDay 
            ? "bg-[radial-gradient(circle_at_50%_30%,#ffd700_0%,transparent_50%)]"
            : "bg-[radial-gradient(circle_at_50%_30%,#4f46e5_0%,transparent_50%)]"
         )} />
      </div>

      <div className="max-w-4xl w-full relative z-10 flex flex-col gap-6">
        <header className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-4">
          <div className="text-center md:text-left flex-1 w-full">
            <div className="flex items-center justify-center md:justify-start gap-2 text-white/70 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium tracking-wide uppercase">আপনার অবস্থান</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight break-words">
              {location ? location.address : "অপেক্ষা করুন..."}
            </h1>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20 whitespace-nowrap">
              <Clock className="w-4 h-4 text-white/70 mr-2" />
              <span className="text-white font-medium">{format(new Date(), 'hh:mm a')}</span>
            </div>
            
            <form onSubmit={handleSearch} className="relative w-full md:w-64">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="অন্য জায়গা সার্চ করুন..."
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 pl-10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 w-full transition-all text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              {isSearching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50 animate-spin" />}
            </form>
          </div>
        </header>

        <LocationFetcher onLocationFound={handleLocationFound} />

        {error && (
           <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-[32px] p-6 text-center">
              <p className="text-red-200 font-medium">{error}</p>
           </div>
        )}

        {loading && !weather && (
          <div className="flex flex-col items-center justify-center p-20 text-white/50 bg-white/5 backdrop-blur-md rounded-[40px] border border-white/10">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
            <p className="text-lg font-medium">তথ্য সংগ্রহ করা হচ্ছে...</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!weather && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-16 text-center text-white/40 bg-white/5 backdrop-blur-md rounded-[40px] border border-white/10"
            >
              <MapPin className="w-16 h-16 opacity-10 mx-auto mb-4" />
              <p className="text-xl">উপরে লোকেশন পারমিশন দিন অথবা <br/> জায়গার নাম লিখে সার্চ করুন</p>
            </motion.div>
          )}

          {weather && (
            <motion.div 
              key={location?.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", loading && "opacity-50 blur-[2px] pointer-events-none transition-all")}
            >
              <div className="lg:col-span-2 bg-white/20 backdrop-blur-2xl rounded-[40px] border border-white/20 p-8 md:p-12 text-white overflow-hidden relative group">
                <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="flex flex-col items-center md:items-start">
                    <div className="flex items-baseline">
                      <span className="text-8xl md:text-9xl font-bold tracking-tighter">
                        {Math.round(weather.current.temp)}
                      </span>
                      <span className="text-5xl md:text-6xl font-light opacity-60 ml-2">°</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-medium opacity-90 mt-2">
                      {getWeatherDescription(weather.current.weatherCode)}
                    </p>
                    <p className="text-lg opacity-60 mt-1 flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      অনুভূত হয়: {Math.round(weather.current.apparentTemp)}°C
                    </p>
                  </div>
                  
                  <div className="flex-1 flex justify-center">
                    <WeatherIcon 
                      code={weather.current.weatherCode} 
                      isDay={weather.current.isDay}
                      className="w-48 h-48 md:w-64 md:h-64 drop-shadow-[0_20px_50px_rgba(255,255,255,0.4)]"
                    />
                  </div>
                </div>

                {insight && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mt-12 bg-white/10 p-6 rounded-3xl border border-white/10 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/20">
                       <span className="text-white font-bold text-[10px]">FARM</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest mb-1">প্রো-পরামর্শ (Poultry Advice)</span>
                      <p className="text-lg text-white leading-tight italic">"{insight}"</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 p-6 text-white flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Wind className="text-blue-200" />
                  </div>
                  <div>
                    <p className="text-sm font-medium opacity-60 uppercase tracking-wider">বাতাসের গতি</p>
                    <p className="text-2xl font-bold">{weather.current.windSpeed} <span className="text-sm font-normal opacity-60">km/h</span></p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 p-6 text-white flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Droplets className="text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium opacity-60 uppercase tracking-wider">আর্দ্রতা</p>
                    <p className="text-2xl font-bold">{weather.current.humidity}<span className="text-sm font-normal opacity-60">%</span></p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 p-6 text-white flex-1 min-h-[160px]">
                  <div className="flex items-center gap-2 mb-4 text-white/60 text-sm font-bold uppercase tracking-widest">
                    <Calendar className="w-4 h-4" />
                    পূর্বাভাস
                  </div>
                  <div className="space-y-4">
                    {weather.daily.time.slice(1, 4).map((time, i) => (
                      <div key={time} className="flex items-center justify-between">
                        <span className="font-medium opacity-80">{format(new Date(time), 'EEEE')}</span>
                        <div className="flex items-center gap-3">
                          <WeatherIcon code={weather.daily.weatherCode[i+1]} className="w-6 h-6" />
                          <span className="font-bold">{Math.round(weather.daily.maxTemp[i+1])}°</span>
                          <span className="opacity-40">{Math.round(weather.daily.minTemp[i+1])}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white/10 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 text-white overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 mb-6 text-white/60 text-sm font-bold uppercase tracking-widest">
                  <Clock className="w-4 h-4" />
                  ঘন্টায় ঘন্টা পূর্বাভাস
                </div>
                <div className="flex gap-8 min-w-max pb-2">
                  {weather.hourly.time.slice(0, 24).filter((_, i) => i % 2 === 0).map((time, i) => {
                    const hourIndex = i * 2;
                    return (
                      <div key={time} className="flex flex-col items-center gap-3 px-4 py-2 rounded-2xl hover:bg-white/5 transition-colors">
                        <span className="text-xs font-bold opacity-40 uppercase">{format(new Date(time), 'ha')}</span>
                        <WeatherIcon code={weather.hourly.weatherCode[hourIndex]} className="w-8 h-8 text-blue-200" />
                        <span className="text-xl font-bold">{Math.round(weather.hourly.temp[hourIndex])}°</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <footer className="text-center py-10 opacity-30 text-white text-xs uppercase tracking-[0.2em] font-bold">
          সঠিক আবহাওয়া • {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
