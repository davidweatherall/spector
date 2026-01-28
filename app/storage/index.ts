import { put } from "@vercel/blob";

export const storeValue = async (key: string, value: string) => {
  const { url } = await put(key, value, { access: 'public' });
  return url;
}
