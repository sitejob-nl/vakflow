export type Industry = "technical" | "cleaning" | "automotive" | "pest" | "landscaping";

export interface IndustryLabels {
  worker: string;
  workerPlural: string;
  workOrder: string;
  workOrders: string;
  appointment: string;
  asset: string;
  assets: string;
  vehicle: string;
  vehicles: string;
  bay: string;
  bays: string;
}

export interface SubcategoryConfig {
  label: string;
  labels: Partial<IndustryLabels>;
}

export interface IndustryConfig {
  name: string;
  icon: string; // lucide icon name
  defaultLabels: IndustryLabels;
  subcategories: Record<string, SubcategoryConfig>;
  modules: string[];
}

export const industryConfig: Record<Industry, IndustryConfig> = {
  technical: {
    name: "Vakflow",
    icon: "Wrench",
    defaultLabels: {
      worker: "Monteur",
      workerPlural: "Monteurs",
      workOrder: "Werkbon",
      workOrders: "Werkbonnen",
      appointment: "Afspraak",
      asset: "Object",
      assets: "Objecten",
      vehicle: "Voertuig",
      vehicles: "Voertuigen",
      bay: "Brug",
      bays: "Bruggen",
    },
    subcategories: {
      installation: {
        label: "Installateur",
        labels: {},
      },
      roofing: {
        label: "Dakdekker",
        labels: { worker: "Dakspecialist", workerPlural: "Dakspecialisten" },
      },
      electrical: {
        label: "Elektricien",
        labels: { worker: "Elektricien", workerPlural: "Elektriciens" },
      },
      painting: {
        label: "Schilder",
        labels: {
          worker: "Schilder",
          workerPlural: "Schilders",
          workOrder: "Schilderopdracht",
          workOrders: "Schilderopdrachten",
        },
      },
      plumbing: {
        label: "Loodgieter",
        labels: { worker: "Loodgieter", workerPlural: "Loodgieters" },
      },
      glazing: {
        label: "Glaszetter",
        labels: { worker: "Glaszetter", workerPlural: "Glaszetters" },
      },
      general: {
        label: "Overig technisch",
        labels: { worker: "Vakman", workerPlural: "Vakmensen" },
      },
    },
    modules: [
      "dashboard", "planning", "customers", "workorders", "invoices",
      "quotes", "reports", "email", "whatsapp", "communication",
      "reminders", "assets", "marketing",
    ],
  },
  cleaning: {
    name: "CleanFlow",
    icon: "Sparkles",
    defaultLabels: {
      worker: "Schoonmaker",
      workerPlural: "Schoonmakers",
      workOrder: "Schoonmaakbon",
      workOrders: "Schoonmaakbonnen",
      appointment: "Schoonmaakbeurt",
      asset: "Object",
      assets: "Objecten",
    },
    subcategories: {
      general: {
        label: "Schoonmaakbedrijf",
        labels: {},
      },
      window: {
        label: "Glazenwasser",
        labels: { worker: "Glazenwasser", workerPlural: "Glazenwassers" },
      },
      facility: {
        label: "Facilitair dienstverlener",
        labels: { worker: "Medewerker", workerPlural: "Medewerkers" },
      },
    },
    modules: [
      "dashboard", "planning", "customers", "workorders", "invoices",
      "quotes", "reports", "email", "whatsapp", "communication",
      "reminders", "assets", "marketing",
    ],
  },
  automotive: {
    name: "AutoFlow",
    icon: "Car",
    defaultLabels: {
      worker: "Mecanicien",
      workerPlural: "Mecaniciens",
      workOrder: "Werkorder",
      workOrders: "Werkorders",
      appointment: "Onderhoudsbeurt",
      asset: "Voertuig",
      assets: "Voertuigen",
    },
    subcategories: {
      garage: {
        label: "Garage / werkplaats",
        labels: {},
      },
      tires: {
        label: "Bandencentrale",
        labels: {
          worker: "Bandenmonteur",
          workerPlural: "Bandenmonteurs",
          workOrder: "Bandenorder",
          workOrders: "Bandenorders",
        },
      },
      bodywork: {
        label: "Schadeherstel",
        labels: {
          worker: "Plaatwerker",
          workerPlural: "Plaatwerkers",
        },
      },
    },
    modules: [
      "dashboard", "planning", "customers", "workorders", "invoices",
      "quotes", "reports", "email", "whatsapp", "communication",
      "reminders", "assets", "marketing",
    ],
  },
  pest: {
    name: "PestFlow",
    icon: "Bug",
    defaultLabels: {
      worker: "Bestrijder",
      workerPlural: "Bestrijders",
      workOrder: "Inspectiebon",
      workOrders: "Inspectiebonnen",
      appointment: "Inspectie",
      asset: "Locatie",
      assets: "Locaties",
    },
    subcategories: {
      general: {
        label: "Ongediertebestrijding",
        labels: {},
      },
    },
    modules: [
      "dashboard", "planning", "customers", "workorders", "invoices",
      "quotes", "reports", "email", "whatsapp", "communication",
      "reminders", "assets", "marketing",
    ],
  },
  landscaping: {
    name: "GroenFlow",
    icon: "TreePine",
    defaultLabels: {
      worker: "Hovenier",
      workerPlural: "Hoveniers",
      workOrder: "Werkbon",
      workOrders: "Werkbonnen",
      appointment: "Afspraak",
      asset: "Object",
      assets: "Objecten",
    },
    subcategories: {
      gardening: {
        label: "Hovenier",
        labels: {},
      },
      tree: {
        label: "Boomverzorger",
        labels: {
          worker: "Boomverzorger",
          workerPlural: "Boomverzorgers",
        },
      },
      maintenance: {
        label: "Groenonderhoud",
        labels: {
          worker: "Medewerker",
          workerPlural: "Medewerkers",
        },
      },
    },
    modules: [
      "dashboard", "planning", "customers", "workorders", "invoices",
      "quotes", "reports", "email", "whatsapp", "communication",
      "reminders", "assets", "marketing",
    ],
  },
};

/** Get merged labels for a given industry + subcategory */
export function getIndustryLabels(
  industry: Industry = "technical",
  subcategory?: string | null,
): IndustryLabels {
  const config = industryConfig[industry] ?? industryConfig.technical;
  const sub = subcategory && config.subcategories[subcategory];
  return {
    ...config.defaultLabels,
    ...(sub?.labels ?? {}),
  };
}
