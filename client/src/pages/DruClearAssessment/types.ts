export type Screen =
  | "splash"
  | "welcome"
  | "lead-capture"
  | "clarity"
  | "leadership"
  | "execution"
  | "alignment"
  | "results-pillar"
  | "calculating"
  | "results"
  | "diagnose"
  | "payment-strategic"
  | "payment-executive"
  | "thankyou-strategic"
  | "thankyou-executive"
  | "expired"
  | "share-your-excitement";

export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country_name?: string;
  country_iso?: string;
  company: string;
  role: string;
}

export interface Scores {
  [key: number]: number;
}
