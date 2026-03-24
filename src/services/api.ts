import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CLOUD_SNAPSHOT_ID } from "@/data/defaultState";
import type { AppSnapshot, DeveloperState } from "@/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const bucketName =
  (import.meta.env.VITE_SUPABASE_BUCKET as string | undefined) || "calendar-media";

let cachedClient: SupabaseClient | null = null;

export const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const getSupabaseClient = () => {
  if (!isCloudConfigured) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl!, supabaseAnonKey!);
  }

  return cachedClient;
};

export const fetchCloudSnapshot = async (): Promise<AppSnapshot | null> => {
  const client = getSupabaseClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("app_state")
    .select("payload")
    .eq("id", CLOUD_SNAPSHOT_ID)
    .single();

  if (error || !data?.payload) {
    return null;
  }

  return data.payload as AppSnapshot;
};

export const saveCloudSnapshot = async (snapshot: AppSnapshot): Promise<DeveloperState> => {
  const client = getSupabaseClient();

  if (!client) {
    return {
      isCloudConfigured: false,
      isSyncing: false
    };
  }

  const { error } = await client.from("app_state").upsert(
    {
      id: CLOUD_SNAPSHOT_ID,
      payload: snapshot,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    return {
      isCloudConfigured: true,
      isSyncing: false,
      lastCloudError: error.message,
      lastCloudMessage: "Ошибка сохранения в облако"
    };
  }

  return {
    isCloudConfigured: true,
    isSyncing: false,
    lastCloudMessage: "Облако синхронизировано"
  };
};

export const uploadImageToCloudIfPossible = async (
  fileName: string,
  dataUrl: string
): Promise<string> => {
  const client = getSupabaseClient();

  if (!client) {
    return dataUrl;
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const safeName = `${Date.now()}-${fileName.replace(/\s+/g, "-")}`;

  const { error } = await client.storage.from(bucketName).upload(safeName, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: blob.type || "image/jpeg"
  });

  if (error) {
    return dataUrl;
  }

  const { data } = client.storage.from(bucketName).getPublicUrl(safeName);
  return data.publicUrl;
};
