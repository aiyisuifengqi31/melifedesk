export type CurrentWeather = {
  apparentTemperature: number;
  description: string;
  humidity: number;
  latitude: number;
  locationLabel: string;
  longitude: number;
  source: "Open-Meteo";
  status: "ready";
  temperature: number;
  unit: string;
  updatedAt: string;
  weatherCode: number;
};

export type WeatherState =
  | CurrentWeather
  | {
      message: string;
      status: "idle" | "loading" | "error";
    };

type Fetcher = (url: string) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
}>;

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type GeolocationLike = {
  getCurrentPosition: (success: (position: GeoPosition) => void, error: (error: unknown) => void, options?: PositionOptions) => void;
};

export async function resolveCurrentCityWeather(input: {
  fetcher?: Fetcher;
  geolocation?: GeolocationLike | null;
  timeoutMs?: number;
} = {}): Promise<WeatherState> {
  const fetcher = input.fetcher ?? fetch;

  // 1. 优先尝试浏览器定位
  const geolocation = input.geolocation ?? (typeof navigator !== "undefined" ? navigator.geolocation : null);
  if (geolocation) {
    try {
      const position = await getCurrentPosition(geolocation, input.timeoutMs ?? 8000);
      const city = await reverseGeocodeCity({
        fetcher,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      return fetchOpenMeteoWeather({
        fetcher,
        latitude: position.coords.latitude,
        locationLabel: city,
        longitude: position.coords.longitude
      });
    } catch {
      // 浏览器定位失败则回退到 IP 定位
    }
  }

  // 2. 浏览器定位不可用/被拒绝时，使用 IP 定位（无需用户授权）
  try {
    const ipLocation = await fetchIpLocation(fetcher);
    if (ipLocation) {
      return fetchOpenMeteoWeather({
        fetcher,
        latitude: ipLocation.latitude,
        locationLabel: ipLocation.city,
        longitude: ipLocation.longitude
      });
    }
  } catch {
    // IP 定位也失败
  }

  return { message: "无法获取位置，请检查网络或允许定位权限。", status: "error" };
}

export async function fetchOpenMeteoWeather(input: {
  fetcher?: Fetcher;
  latitude: number;
  locationLabel?: string;
  longitude: number;
}): Promise<CurrentWeather> {
  const fetcher = input.fetcher ?? fetch;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code");
  url.searchParams.set("timezone", "auto");

  const response = await fetcher(url.toString());
  if (!response.ok) {
    throw new Error("weather_request_failed");
  }

  const payload = (await response.json()) as {
    current?: {
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      temperature_2m?: number;
      time?: string;
      weather_code?: number;
    };
    current_units?: {
      temperature_2m?: string;
    };
    latitude?: number;
    longitude?: number;
  };

  const weatherCode = payload.current?.weather_code ?? 0;
  return {
    apparentTemperature: Math.round(payload.current?.apparent_temperature ?? 0),
    description: weatherCodeToText(weatherCode),
    humidity: Math.round(payload.current?.relative_humidity_2m ?? 0),
    latitude: payload.latitude ?? input.latitude,
    locationLabel: input.locationLabel ?? "当前位置",
    longitude: payload.longitude ?? input.longitude,
    source: "Open-Meteo",
    status: "ready",
    temperature: Math.round(payload.current?.temperature_2m ?? 0),
    unit: payload.current_units?.temperature_2m ?? "°C",
    updatedAt: payload.current?.time ?? "",
    weatherCode
  };
}

async function reverseGeocodeCity(input: { fetcher: Fetcher; latitude: number; longitude: number }) {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("localityLanguage", "zh");

  const response = await input.fetcher(url.toString());
  if (!response.ok) {
    return "当前城市";
  }

  const payload = (await response.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
  };

  return payload.city || payload.locality || payload.principalSubdivision || "当前城市";
}

function getCurrentPosition(geolocation: GeolocationLike, timeoutMs: number) {
  return new Promise<GeoPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: timeoutMs
    });
  });
}

async function fetchIpLocation(fetcher: Fetcher): Promise<{ city: string; latitude: number; longitude: number } | null> {
  try {
    const response = await fetcher("https://ipapi.co/json/");
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      city?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!payload.latitude || !payload.longitude) {
      return null;
    }
    return {
      city: payload.city || "当前城市",
      latitude: payload.latitude,
      longitude: payload.longitude
    };
  } catch {
    return null;
  }
}

function weatherCodeToText(code: number) {
  // WMO Weather interpretation codes (WW) 中文描述
  if (code === 0) return "晴";
  if ([1, 2].includes(code)) return "多云";
  if (code === 3) return "阴";
  if ([45, 48].includes(code)) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "小雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷阵雨";
  return "晴";
}

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "⛅";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}
