import AsyncStorage from "@react-native-async-storage/async-storage";
import { IS_COACH_APP } from "../config/appVariant";

const APP_CACHE_PREFIX = IS_COACH_APP ? "ukali-coach-screen-cache-v1" : "ukali-athlete-screen-cache-v1";
const memoryCache = new Map<string, string>();

function buildKey(key: string) {
  return `${APP_CACHE_PREFIX}:${key}`;
}

export function peekScreenCache<T>(key: string): T | null {
  try {
    const raw = memoryCache.get(buildKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function readScreenCache<T>(key: string): Promise<T | null> {
  try {
    const cacheKey = buildKey(key);
    const inMemory = memoryCache.get(cacheKey);
    if (inMemory) {
      return JSON.parse(inMemory) as T;
    }

    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      memoryCache.set(cacheKey, raw);
    }
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeScreenCache<T>(key: string, value: T): Promise<void> {
  try {
    const cacheKey = buildKey(key);
    const raw = JSON.stringify(value);
    memoryCache.set(cacheKey, raw);
    await AsyncStorage.setItem(cacheKey, raw);
  } catch {
    // Ignore cache write failures.
  }
}
