// _shared/supabase.ts — Supabase client creation + auth helpers

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Service role client — volledige DB toegang, gebruik alleen server-side */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** User-scoped client — respecteert RLS policies */
export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export interface AuthContext {
  userId: string;
  companyId: string;
}

/**
 * Authenticate een request en haal userId + companyId op.
 * Gooit een AuthError als auth faalt.
 */
export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Niet ingelogd", 401);
  }

  const supabaseUser = createUserClient(authHeader);

  // FIX: getClaims() bestaat niet — gebruik getUser()
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) {
    throw new AuthError("Ongeldige sessie", 401);
  }

  const userId = userData.user.id;
  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!profile?.company_id) {
    throw new AuthError("Geen bedrijf gevonden", 400);
  }

  return { userId, companyId: profile.company_id };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}