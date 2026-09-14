import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(refreshedCookies) {
        try {
          for (const { name, value, options } of refreshedCookies) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não escrevem cookies; o proxy.ts já renovou a sessão.
        }
      },
    },
  });
}
