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
      weather?.current.isDay ? "bg-sky-400" : "bg-[#0a0a0a]"
    )}>
      {/* Dynamic Immersive Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden overflow-y-auto">
         <div className={cn(
           "absolute top-[-20%] left-[-20%] w-[140%] h-[140%] blur-[120px] transition-all duration-1000",
           weather?.current.isDay 
            ? "bg-[radial-gradient(circle_at_50%_30%,#ffd700_0%,rgba(56,189,248,0.2)_50%,transparent_100%)]"
            : "bg-[radial-gradient(circle_at_50%_30%,#312e81_0%,rgba(15,23,42,0.5)_50%,transparent_100%)]"
         )} />
      </div>

      <div className="max-w-5xl w-full relative z-10 flex flex-col gap-8">
        <header className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-6">
          <div className="text-center md:text-left flex-1 w-full animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-white/70 mb-3">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">সরকার অনুমোদিত আবহাওয়া</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter break-words leading-none mb-2">
              {location ? location.address : "লোকেশনের নাম..."}
            </h1>
            {location && <p className="text-white/50 text-xs font-medium uppercase tracking-widest">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto">
            <div className="flex items-center bg-white/10 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/20 shadow-xl self-center md:self-auto">
              <Clock className="w-4 h-4 text-white/70 mr-3" />
              <span className="text-xl font-bold text-white tracking-tight">{format(new Date(), 'hh:mm a')}</span>
            </div>
            
            <form onSubmit={handleSearch} className="relative w-full md:w-80 group">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="যেকোনো গ্রাম বা থানা সার্চ করুন..."
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-4 pl-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/40 w-full transition-all text-sm shadow-lg group-hover:bg-white/20"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              {isSearching && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />}
            </form>
          </div>
        </header>

        <LocationFetcher onLocationFound={handleLocationFound} />

        {error && (
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-3xl p-6 text-center"
           >
              <p className="text-red-200 font-bold">{error}</p>
           </motion.div>
        )}

        {loading && !weather && (
          <div className="flex flex-col items-center justify-center py-32 text-white/50 glass-card rounded-5xl">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-sky-400 opacity-20 animate-pulse" />
              <RefreshCw className="w-16 h-16 mb-6 animate-spin relative z-10" />
            </div>
            <p className="text-xl font-bold tracking-tight animate-pulse">নির্ভুল তথ্য খোঁজা হচ্ছে...</p>
            <p className="text-sm opacity-60 mt-2">অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন</p>
          </div>
        )}

        {!weather && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-20 text-center text-white/40 glass-card rounded-5xl"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
              <MapPin className="w-10 h-10 opacity-30" />
            </div>
            <p className="text-2xl font-bold text-white mb-2 leading-tight">স্বাগতম সঠিক আবহাওয়ায়</p>
            <p className="text-white/40 max-w-sm mx-auto">উপরে আপনার লোকেশন পারমিশন দিন অথবা সরাসরি জায়গার নাম লিখে সার্চ করুন</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {weather && (
            <motion.div 
              key={location?.address}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", loading && "opacity-50 blur-[2px] transition-all duration-500")}
            >
              {/* Main Forecast Card */}
              <div className="lg:col-span-8 glass-card rounded-5xl p-8 md:p-14 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <WeatherIcon code={weather.current.weatherCode} isDay={weather.current.isDay} className="w-40 h-40" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="flex flex-col items-center md:items-start">
                      <div className="flex items-start">
                        <span className="text-8xl md:text-[11rem] font-black tracking-tighter leading-none text-glow">
                          {Math.round(weather.current.temp)}
                        </span>
                        <span className="text-5xl md:text-7xl font-light opacity-40 -mt-2 md:mt-2">°</span>
                      </div>
                      <div className="flex flex-col items-center md:items-start mt-4">
                        <h2 className="text-2xl md:text-4xl font-bold tracking-tight opacity-90">
                          {getWeatherDescription(weather.current.weatherCode)}
                        </h2>
                        <div className="flex items-center gap-4 mt-3 py-2 px-4 bg-white/5 rounded-full border border-white/10">
                          <p className="text-sm font-medium opacity-70 flex items-center gap-2">
                            <Thermometer className="w-3.5 h-3.5 text-orange-300" />
                            অনুভূত: <span className="text-white font-bold">{Math.round(weather.current.apparentTemp)}°C</span>
                          </p>
                          <div className="w-px h-3 bg-white/20" />
                          <p className="text-sm font-medium opacity-70 flex items-center gap-2">
                            <Wind className="w-3.5 h-3.5 text-blue-300" />
                            বাতাস: <span className="text-white font-bold">{weather.current.windSpeed} km/h</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex justify-center animate-float">
                      <WeatherIcon 
                        code={weather.current.weatherCode} 
                        isDay={weather.current.isDay}
                        className="w-48 h-48 md:w-64 md:h-64 drop-shadow-[0_20px_50px_rgba(255,255,255,0.4)]"
                      />
                    </div>
                  </div>

                  {/* AI Insight / Poultry Advice */}
                  {insight && (
                    <motion.div 
                      key={insight}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-16 bg-gradient-to-r from-yellow-500/20 to-orange-500/10 backdrop-blur-2xl p-8 rounded-[40px] border border-yellow-500/30 flex flex-col md:flex-row items-center gap-6 shadow-2xl overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full" />
                      <div className="w-16 h-16 bg-yellow-500 rounded-[24px] flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/40 relative z-10 rotate-3">
                         <span className="text-white font-black text-xs tracking-tighter">FARM</span>
                      </div>
                      <div className="flex flex-col relative z-10 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                          <span className="text-[10px] uppercase font-black text-yellow-500 tracking-[0.2em]">পোল্ট্রি খামার পরামর্শ</span>
                          <div className="h-1 w-8 bg-yellow-500/30 rounded-full" />
                        </div>
                        <p className="text-xl md:text-2xl text-white font-bold leading-tight line-clamp-3">
                          "{insight}"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Environmental Details Bento Grid */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-card rounded-[40px] p-8 flex items-center gap-6 glass-card-hover">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center shadow-inner">
                    <Droplets className="text-blue-300 w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold opacity-40 uppercase tracking-[0.2em] mb-1">আর্দ্রতা (Humidity)</p>
                    <p className="text-4xl font-black text-white">{weather.current.humidity}<span className="text-lg font-light opacity-40 ml-1">%</span></p>
                  </div>
                </div>

                <div className="glass-card rounded-[40px] p-8 flex-1 min-h-[300px] flex flex-col glass-card-hover">
                  <div className="flex items-center gap-3 mb-8 text-white/50 text-xs font-black uppercase tracking-[0.2em]">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <Calendar className="w-4 h-4 text-indigo-300" />
                    </div>
                    আগামী ৩ দিনের পূর্বাভাস
                  </div>
                  <div className="space-y-6 flex-1">
                    {weather.daily.time.slice(1, 4).map((time, i) => (
                      <div key={time} className="group flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white tracking-tight">{format(new Date(time), 'EEEE')}</span>
                          <span className="text-[10px] font-medium opacity-40 uppercase tracking-widest">{format(new Date(time), 'dd MMM')}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <WeatherIcon code={weather.daily.weatherCode[i+1]} className="w-8 h-8 drop-shadow-lg" />
                          <div className="text-right flex flex-col">
                            <span className="text-xl font-black text-white leading-none">{Math.round(weather.daily.maxTemp[i+1])}°</span>
                            <span className="text-xs font-bold opacity-30 mt-1">{Math.round(weather.daily.minTemp[i+1])}°</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hourly Timeline */}
              <div className="lg:col-span-12 glass-card rounded-[50px] p-10 text-white overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3 text-white/50 text-xs font-black uppercase tracking-[0.2em]">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Clock className="w-4 h-4 text-emerald-300" />
                    </div>
                    ঘন্টায় ঘন্টা পূর্বাভাস (Timeline)
                  </div>
                  <div className="hidden md:block h-px flex-1 mx-8 bg-white/10" />
                  <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Next 24 Hours</span>
                </div>
                
                <div className="overflow-x-auto no-scrollbar pb-2">
                  <div className="flex gap-4 min-w-max">
                    {weather.hourly.time.slice(0, 24).filter((_, i) => i % 1 === 0).map((time, i) => {
                      const hourIndex = i;
                      const isCurrent = format(new Date(), 'H') === format(new Date(time), 'H');
                      return (
                        <div 
                          key={time} 
                          className={cn(
                            "flex flex-col items-center gap-4 px-6 py-8 rounded-[32px] transition-all duration-500 group relative",
                            isCurrent ? "bg-white/15 border border-white/30 scale-105 shadow-2xl" : "hover:bg-white/10 border border-transparent"
                          )}
                        >
                          {isCurrent && <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-full shadow-lg" />}
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", isCurrent ? "text-white" : "opacity-40 group-hover:opacity-100 transition-opacity")}>
                            {format(new Date(time), 'ha')}
                          </span>
                          <div className="relative">
                            <WeatherIcon code={weather.hourly.weatherCode[hourIndex]} className={cn("w-10 h-10 transition-transform duration-500 group-hover:scale-110", isCurrent ? "text-white" : "text-white/60")} />
                          </div>
                          <span className={cn("text-2xl font-black tracking-tighter", isCurrent ? "text-white" : "text-white/80")}>
                            {Math.round(weather.hourly.temp[hourIndex])}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <footer className="w-full flex flex-col items-center gap-6 py-16">
          <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black text-white/30 tracking-[0.4em] uppercase">সঠিক আবহাওয়া প্রো • {new Date().getFullYear()}</p>
            <p className="text-[9px] font-medium text-white/20 uppercase tracking-[0.1em]">ওপেন-মেটিও ডেটা দ্বারা পরিচালিত। এটি একটি স্থায়ী এবং সুরক্ষিত অ্যাপ্লিকেশন।</p>
          </div>
          <div className="flex gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none">System Active & Professional Mode Enabled</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
