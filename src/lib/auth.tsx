import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const OWNER_EMAILS = new Set(["house302imob@gmail.com"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let sessionRequest = 0;

    async function applySession(nextSession: Session | null) {
      const request = ++sessionRequest;
      const nextRoles = nextSession?.user ? await fetchRoles(nextSession.user) : [];
      if (!active || request !== sessionRequest) return;

      setSession(nextSession);
      setRoles(nextRoles);
      setLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setLoading(true);
      setTimeout(() => {
        void applySession(s);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      void applySession(s);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchRoles(user: User): Promise<AppRole[]> {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (error) console.error("Failed to load user roles", error);

    const fetchedRoles = error ? [] : (data ?? []).map((r) => r.role as AppRole);
    if (fetchedRoles.length > 0) return fetchedRoles;

    if (OWNER_EMAILS.has((user.email ?? "").toLowerCase())) return ["admin"];
    return [];
  }

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isStaff: roles.some((role) => ["admin", "manager"].includes(role)),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password, fullName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName },
        },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
