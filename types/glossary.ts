export interface GlossaryTerm {
  term: string;
  abbreviation: string | null;
  previousTerm: string | null;
  description: string;
  learnMoreUrl: string | null;
  category: string;
}

export interface GlossaryData {
  terms: GlossaryTerm[];
} 