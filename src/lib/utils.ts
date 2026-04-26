import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safe fetch wrapper that handles transient development errors
 * where HTML error pages are returned instead of JSON
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    
    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (retries > 0) {
        // Wait and retry for transient dev errors
        await new Promise(resolve => setTimeout(resolve, 1000));
        return safeFetch<T>(url, options, retries - 1);
      }
      console.error("Server returned non-JSON response for:", url);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      // Wait and retry for transient errors
      await new Promise(resolve => setTimeout(resolve, 1000));
      return safeFetch<T>(url, options, retries - 1);
    }
    console.error("Fetch failed:", error);
    return null;
  }
}
