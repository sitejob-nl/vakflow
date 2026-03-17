export interface CriterionDef {
  id: string;
  name: string;
  weight: number;
}

export const DEFAULT_CLEANING_CRITERIA: CriterionDef[] = [
  { id: "stof", name: "Stof op oppervlakken", weight: 1.0 },
  { id: "vloer", name: "Vloerreiniging", weight: 1.2 },
  { id: "sanitair", name: "Sanitair", weight: 1.3 },
  { id: "afval", name: "Afvalbakken & afval", weight: 0.8 },
  { id: "glas", name: "Ramen & glaswerk", weight: 0.9 },
  { id: "inventaris", name: "Inventaris & meubilair", weight: 1.0 },
];

export const AUDIT_TYPES = [
  { value: "internal", label: "Intern" },
  { value: "klant", label: "Klantinspectie" },
  { value: "dks", label: "DKS-audit" },
] as const;

export const ROOM_TYPE_ICONS: Record<string, string> = {
  receptie: "🏢",
  kantoor: "💼",
  sanitair: "🚿",
  kantine: "🍽️",
  vergaderruimte: "📋",
  technisch: "⚙️",
  klaslokaal: "📚",
  sportzaal: "🏃",
  kleedkamer: "👔",
};

export interface CriterionScore {
  id: string;
  name: string;
  score: number;
  max: number;
  weight: number;
}

export interface RoomScoreInput {
  room_id: string | null;
  room_name: string;
  room_type: string | null;
  criteria: CriterionScore[];
  score: number | null;
  notes: string;
}

export const calcRoomScore = (criteria: CriterionScore[]): number | null => {
  const scored = criteria.filter((c) => c.score > 0);
  if (scored.length === 0) return null;
  const totalWeightedScore = scored.reduce((sum, c) => sum + (c.score / 5) * 10 * c.weight, 0);
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0);
  return totalWeightedScore / totalWeight;
};

export const calcOverallScore = (roomScores: RoomScoreInput[]): number | null => {
  const scores = roomScores.map((r) => calcRoomScore(r.criteria)).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
};
