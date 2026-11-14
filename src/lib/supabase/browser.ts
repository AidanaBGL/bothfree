import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client, keyed by the public publishable key only. Never
 * import the service-role key here — this bundle ships to the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
