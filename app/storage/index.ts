'use server';

import { put, list, del } from "@vercel/blob";

const vercelBlobReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN

/**
 * Store a value in Vercel Blob Storage
 * @param key - The key/path to store the value under (e.g., "converted/series_123.json")
 * @param value - The string value to store
 * @returns The URL of the stored blob
 */
export const storeValue = async (key: string, value: string): Promise<string> => {
  const { url } = await put(key, value, { 
    access: 'public', 
    token: vercelBlobReadWriteToken,
    addRandomSuffix: false, // Use exact key name
    allowOverwrite: true // Allow updating existing blobs
  });
  return url;
}

/**
 * Read a value from Vercel Blob Storage
 * @param key - The key/path to read from
 * @returns The stored value as a string, or null if not found
 */
export const readValue = async (key: string): Promise<string | null> => {
  try {
    // List blobs with the prefix to find the exact key
    const { blobs } = await list({ 
      prefix: key,
      token: vercelBlobReadWriteToken 
    });
    
    // Find exact match
    const blob = blobs.find(b => b.pathname === key);
    if (!blob) return null;
    
    // Fetch the content
    const response = await fetch(blob.url);
    if (!response.ok) return null;
    
    return await response.text();
  } catch (error) {
    console.error(`Error reading blob ${key}:`, error);
    return null;
  }
}

/**
 * Check if a value exists in Vercel Blob Storage
 * @param key - The key/path to check
 * @returns True if the value exists
 */
export const existsValue = async (key: string): Promise<boolean> => {
  try {
    const { blobs } = await list({ 
      prefix: key,
      token: vercelBlobReadWriteToken 
    });
    return blobs.some(b => b.pathname === key);
  } catch {
    return false;
  }
}

/**
 * Delete a value from Vercel Blob Storage
 * @param key - The key/path to delete
 */
export const deleteValue = async (key: string): Promise<void> => {
  try {
    const { blobs } = await list({ 
      prefix: key,
      token: vercelBlobReadWriteToken 
    });
    const blob = blobs.find(b => b.pathname === key);
    if (blob) {
      await del(blob.url, { token: vercelBlobReadWriteToken });
    }
  } catch (error) {
    console.error(`Error deleting blob ${key}:`, error);
  }
}

/**
 * Store JSON data in Vercel Blob Storage
 * @param key - The key/path to store under
 * @param data - The data to store (will be JSON stringified)
 */
export const storeJSON = async <T>(key: string, data: T): Promise<string> => {
  return storeValue(key, JSON.stringify(data));
}

/**
 * Read JSON data from Vercel Blob Storage
 * @param key - The key/path to read from
 * @returns The parsed JSON data, or null if not found
 */
export const readJSON = async <T>(key: string): Promise<T | null> => {
  const value = await readValue(key);
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    console.error(`Error parsing JSON from blob ${key}`);
    return null;
  }
}
