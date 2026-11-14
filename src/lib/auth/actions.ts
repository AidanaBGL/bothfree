import { createClient } from "@/lib/supabase/browser";

/**
 * Thin client-side auth helpers over Supabase Auth. Everything is a no-op when
 * Supabase isn't configured yet, so the app keeps working as a local demo until
 * the env vars in .env.local are filled in (see SUPABASE_SETUP.md).
 */

export function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !url.includes("YOUR_") && !key.includes("YOUR_"));
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  dob: string;
  gender: string;
  lgbtqFriendly: boolean;
}

/**
 * Create an account. When "Confirm email" is on in Supabase, no session is
 * returned yet and the user must verify a 6-digit code (needsVerify=true).
 */
export async function authSignUp(input: SignUpInput): Promise<{ error?: string; needsVerify?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        name: input.name,
        date_of_birth: input.dob,
        gender: input.gender,
        lgbtq_friendly: input.lgbtqFriendly,
      },
    },
  });
  if (error) return { error: error.message };
  return { needsVerify: !data.session };
}

/** Verify the 6-digit signup code emailed to the user. */
export async function authVerify(email: string, token: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  return error ? { error: error.message } : {};
}

export async function authSignIn(email: string, password: string): Promise<{ error?: string; name?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const name = (data.user?.user_metadata?.name as string | undefined) ?? email.split("@")[0];
  return { name };
}

export async function authSignOut(): Promise<void> {
  if (!supabaseConfigured()) return;
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** Current signed-in user, or null. Used to restore a real session on load. */
export async function authCurrentUser(): Promise<{ name: string; email: string } | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    name: (data.user.user_metadata?.name as string | undefined) ?? data.user.email?.split("@")[0] ?? "You",
    email: data.user.email ?? "",
  };
}
