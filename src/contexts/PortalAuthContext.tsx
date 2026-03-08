import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface PortalAuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  customerId: string | null;
  companyId: string | null;
  customerName: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export const PortalAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  const fetchPortalData = async (userId: string) => {
    // Check if this user is a portal user
    const { data: portalUser, error } = await supabase
      .from("portal_users")
      .select("customer_id, company_id")
      .eq("id", userId)
      .single();

    if (error || !portalUser) {
      // Not a portal user
      setCustomerId(null);
      setCompanyId(null);
      return;
    }

    setCustomerId(portalUser.customer_id);
    setCompanyId(portalUser.company_id);

    // Fetch customer name
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", portalUser.customer_id)
      .single();
    setCustomerName(customer?.name ?? null);

    // Fetch company info
    const { data: company } = await supabase
      .from("companies_safe" as any)
      .select("name, logo_url")
      .eq("id", portalUser.company_id)
      .single() as { data: any };
    setCompanyName(company?.name ?? null);
    setCompanyLogoUrl(company?.logo_url ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchPortalData(session.user.id), 0);
      } else {
        setCustomerId(null);
        setCompanyId(null);
        setCustomerName(null);
        setCompanyName(null);
        setCompanyLogoUrl(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPortalData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <PortalAuthContext.Provider value={{
      session, user, loading,
      customerId, companyId, customerName, companyName, companyLogoUrl,
      signIn, signOut,
    }}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = () => {
  const context = useContext(PortalAuthContext);
  if (!context) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return context;
};
