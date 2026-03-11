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
  | "reports"
  | "communication"
  | "email"
  | "whatsapp"
  | "reminders"
  | "assets"
  | "vehicles"
  | "vehDetail"
  | "contracts"
  | "marketing"
  | "trade"
  | "schedule"
  | "settings"
  | "audits"
  | "projects"
  | "projDetail"
  | "leads"
  | "accounting"
  | "superadmin";

const routeMap: Record<Page, string> = {
  dashboard: "/dashboard",
  planning: "/planning",
  customers: "/customers",
  custDetail: "/customers/:id",
  workorders: "/workorders",
  woDetail: "/workorders/:id",
  invoices: "/invoices",
  quotes: "/quotes",
  reports: "/reports",
  communication: "/communication",
  email: "/email",
  whatsapp: "/whatsapp",
  reminders: "/reminders",
  contracts: "/contracts",
  assets: "/assets",
  vehicles: "/vehicles",
  vehDetail: "/vehicles/:id",
  marketing: "/marketing",
  trade: "/trade",
  schedule: "/schedule",
  settings: "/settings",
  audits: "/audits",
  projects: "/projects",
  projDetail: "/projects/:id",
  leads: "/leads",
  accounting: "/boekhouding",
  superadmin: "/superadmin",
};

const pathToPage: [RegExp, Page][] = [
  [/^\/customers\/(.+)$/, "custDetail"],
  [/^\/workorders\/(.+)$/, "woDetail"],
  [/^\/vehicles\/(.+)$/, "vehDetail"],
  [/^\/projects\/(.+)$/, "projDetail"],
  [/^\/dashboard\/?$/, "dashboard"],
  [/^\/planning\/?$/, "planning"],
  [/^\/customers\/?$/, "customers"],
  [/^\/workorders\/?$/, "workorders"],
  [/^\/invoices\/?$/, "invoices"],
  [/^\/quotes\/?$/, "quotes"],
  [/^\/reports\/?$/, "reports"],
  [/^\/communication\/?$/, "communication"],
  [/^\/email\/?$/, "email"],
  [/^\/whatsapp\/?$/, "whatsapp"],
  [/^\/reminders\/?$/, "reminders"],
  [/^\/contracts\/?$/, "contracts"],
  [/^\/assets\/?$/, "assets"],
  [/^\/vehicles\/?$/, "vehicles"],
  [/^\/marketing\/?$/, "marketing"],
  [/^\/trade\/?$/, "trade"],
  [/^\/schedule\/?$/, "schedule"],
  [/^\/settings\/?$/, "settings"],
  [/^\/audits\/?$/, "audits"],
  [/^\/projects\/?$/, "projects"],
  [/^\/leads\/?$/, "leads"],
  [/^\/superadmin\/?$/, "superadmin"],
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
    if (currentPage === "vehDetail") return { vehicleId: id };
    if (currentPage === "projDetail") return { projectId: id };
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
    } else if (page === "vehDetail" && navParams?.vehicleId) {
      path = `/vehicles/${navParams.vehicleId}`;
    } else if (page === "vehDetail" && navParams?.id) {
      path = `/vehicles/${navParams.id}`;
    } else if (page === "projDetail" && navParams?.projectId) {
      path = `/projects/${navParams.projectId}`;
    } else if (page === "projDetail" && navParams?.id) {
      path = `/projects/${navParams.id}`;
    }
    routerNavigate(path);
  };

  return { currentPage, navigate, params };
};
