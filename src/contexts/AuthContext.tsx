import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "monteur" | "super_admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  companyId: string | null;
  realCompanyId: string | null;
  companyLogoUrl: string | null;
  companyBrandColor: string | null;
  onboardingCompleted: boolean | null;
  impersonatedCompanyName: string | null;
  isImpersonating: boolean;
  maxUsers: number;
  enabledFeatures: string[];
  impersonate: (companyId: string, companyName: string) => void;
  stopImpersonating: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [realCompanyId, setRealCompanyId] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(null);
  const [impersonatedCompanyName, setImpersonatedCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyBrandColor, setCompanyBrandColor] = useState<string | null>(null);
  const [maxUsersState, setMaxUsersState] = useState<number>(2);
  const [enabledFeaturesState, setEnabledFeaturesState] = useState<string[]>([]);
  const [impersonatedLogoUrl, setImpersonatedLogoUrl] = useState<string | null>(null);
  const [impersonatedBrandColor, setImpersonatedBrandColor] = useState<string | null>(null);
  const [impersonatedMaxUsers, setImpersonatedMaxUsers] = useState<number | null>(null);
  const [impersonatedEnabledFeatures, setImpersonatedEnabledFeatures] = useState<string[] | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string) => {
    if (fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;

    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("onboarding_completed, company_id").eq("id", userId).single(),
    ]);
    // Pick the highest-privilege role: super_admin > admin > monteur
    const roles = (roleRes.data ?? []).map(r => r.role as AppRole);
    const bestRole: AppRole | null = roles.includes("super_admin") ? "super_admin" : roles.includes("admin") ? "admin" : roles[0] ?? null;
    setRole(bestRole);
    setOnboardingCompleted(profileRes.data?.onboarding_completed ?? null);
    const cid = profileRes.data?.company_id ?? null;
    setRealCompanyId(cid);

    // Fetch company logo
    if (cid) {
      const { data: companyData } = await supabase.from("companies_safe" as any).select("logo_url, brand_color, max_users, enabled_features").eq("id", cid).single() as { data: any };
      setCompanyLogoUrl(companyData?.logo_url ?? null);
      setCompanyBrandColor(companyData?.brand_color ?? null);
      setMaxUsersState(companyData?.max_users ?? 2);
      setEnabledFeaturesState(companyData?.enabled_features ?? []);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole(null);
          setOnboardingCompleted(null);
          setRealCompanyId(null);
          setImpersonatedCompanyId(null);
          setImpersonatedCompanyName(null);
          fetchedForRef.current = null;
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const impersonate = async (companyId: string, companyName: string) => {
    setImpersonatedCompanyId(companyId);
    setImpersonatedCompanyName(companyName);
    const { data } = await supabase.from("companies_safe" as any).select("logo_url, brand_color, max_users, enabled_features").eq("id", companyId).single() as { data: any };
    setImpersonatedLogoUrl(data?.logo_url ?? null);
    setImpersonatedBrandColor(data?.brand_color ?? null);
    setImpersonatedMaxUsers(data?.max_users ?? 2);
    setImpersonatedEnabledFeatures(data?.enabled_features ?? []);
  };

  const stopImpersonating = () => {
    setImpersonatedCompanyId(null);
    setImpersonatedCompanyName(null);
    setImpersonatedLogoUrl(null);
    setImpersonatedBrandColor(null);
    setImpersonatedMaxUsers(null);
    setImpersonatedEnabledFeatures(null);
  };

  const companyId = impersonatedCompanyId ?? realCompanyId;
  const isImpersonating = !!impersonatedCompanyId;
  const activeLogoUrl = impersonatedLogoUrl ?? companyLogoUrl;
  const activeBrandColor = impersonatedBrandColor ?? companyBrandColor;
  const maxUsers = impersonatedMaxUsers ?? maxUsersState;
  const enabledFeatures = impersonatedEnabledFeatures ?? enabledFeaturesState;

  return (
    <AuthContext.Provider value={{
      session, user, loading, role, isAdmin, isSuperAdmin,
      companyId, realCompanyId, companyLogoUrl: activeLogoUrl, companyBrandColor: activeBrandColor,
      onboardingCompleted, impersonatedCompanyName, isImpersonating,
      maxUsers, enabledFeatures,
      impersonate, stopImpersonating,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
