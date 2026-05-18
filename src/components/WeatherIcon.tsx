import React, { useMemo } from 'react';
import { 
  Cloud, 
  CloudDrizzle, 
  CloudFog, 
  CloudLightning, 
  CloudRain, 
  CloudSnow, 
  CloudSun, 
  Sun, 
  Moon,
  CloudMoon,
  Wind
} from 'lucide-react';

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ code, isDay = true, className }) => {
  const Icon = useMemo(() => {
    // WMO Weather interpretation codes (WW)
    // https://open-meteo.com/en/docs
    switch (code) {
      case 0: return isDay ? Sun : Moon;
      case 1:
      case 2: return isDay ? CloudSun : CloudMoon;
      case 3: return Cloud;
      case 45:
      case 48: return CloudFog;
      case 51:
      case 53:
      case 55: return CloudDrizzle;
      case 61:
      case 63:
      case 65: return CloudRain;
      case 80:
      case 81:
      case 82: return CloudRain;
      case 71:
      case 73:
      case 75:
      case 77: return CloudSnow;
      case 95:
      case 96:
      case 99: return CloudLightning;
      default: return Cloud;
    }
  }, [code, isDay]);

  return <Icon className={className} />;
};
