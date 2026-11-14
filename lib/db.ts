import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars are missing. Session persistence will be unavailable until they are configured.");
}

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function initDb() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("sessions").select("session_id").limit(1);
  if (error && error.code !== "PGRST116") {
    throw error;
  }
}

export async function saveSessionRecord(sessionId: string, payload: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("sessions").upsert(
    {
      session_id: sessionId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );

  if (error) {
    throw error;
  }
}

export async function getSessionRecord(sessionId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("session_id, payload")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    sessionId: data.session_id,
    payload: data.payload,
  };
}
