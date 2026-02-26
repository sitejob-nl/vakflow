import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";

export type Page =
  | "dashboard"
  | "planning"
  | "customers"
  | "custDetail"
  | "workorders"
  | "woDetail"
  | "invoices"
  | "quotes"
  | "communication"
  | "email"
  | "whatsapp"
  | "reminders"
  | "settings";

const routeMap: Record<Page, string> = {
  dashboard: "/dashboard",
  planning: "/planning",
  customers: "/customers",
  custDetail: "/customers/:id",
  workorders: "/workorders",
  woDetail: "/workorders/:id",
  invoices: "/invoices",
  quotes: "/quotes",
  communication: "/communication",
  email: "/email",
  whatsapp: "/whatsapp",
  reminders: "/reminders",
  settings: "/settings",
};

const pathToPage: [RegExp, Page][] = [
  [/^\/customers\/(.+)$/, "custDetail"],
  [/^\/workorders\/(.+)$/, "woDetail"],
  [/^\/dashboard\/?$/, "dashboard"],
  [/^\/planning\/?$/, "planning"],
  [/^\/customers\/?$/, "customers"],
  [/^\/workorders\/?$/, "workorders"],
  [/^\/invoices\/?$/, "invoices"],
  [/^\/quotes\/?$/, "quotes"],
  [/^\/communication\/?$/, "communication"],
  [/^\/email\/?$/, "email"],
  [/^\/whatsapp\/?$/, "whatsapp"],
  [/^\/reminders\/?$/, "reminders"],
  [/^\/settings\/?$/, "settings"],
  [/^\/$/, "dashboard"],
];

export const useNavigation = () => {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const urlParams = useParams();

  const currentPage = useMemo<Page>(() => {
    for (const [regex, page] of pathToPage) {
      if (regex.test(location.pathname)) return page;
    }
    return "dashboard";
  }, [location.pathname]);

  // Build params compatible with existing usage (customerId, workOrderId)
  const params = useMemo<Record<string, string>>(() => {
    const id = urlParams.id ?? "";
    if (currentPage === "custDetail") return { customerId: id };
    if (currentPage === "woDetail") return { workOrderId: id };
    return {};
  }, [currentPage, urlParams.id]);

  const navigate = (page: Page, navParams?: Record<string, string>) => {
    let path = routeMap[page];
    if (page === "custDetail" && navParams?.customerId) {
      path = `/customers/${navParams.customerId}`;
    } else if (page === "custDetail" && navParams?.id) {
      path = `/customers/${navParams.id}`;
    } else if (page === "woDetail" && navParams?.workOrderId) {
      path = `/workorders/${navParams.workOrderId}`;
    } else if (page === "woDetail" && navParams?.id) {
      path = `/workorders/${navParams.id}`;
    }
    routerNavigate(path);
  };

  return { currentPage, navigate, params };
};
