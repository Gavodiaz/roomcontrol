// modules/supabase.js

const SUPABASE_URL = "https://efoqflojnflvjcnwqmbv.supabase.co";
const SUPABASE_KEY = "sb_publishable_vJmwrWruhAuoMa1w1hJNaA_zdagIpTT";

// Al poner la palabra 'export', permitimos que otros archivos puedan usar esta conexión
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);