import { z } from "zod"

export const jobRoles = [
  "CEO/Co-Founder",
  "CTO/Co-Founder",
  "Product Manager",
  "Engineering Manager",
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Data Scientist",
  "UI/UX Designer",
  "Marketing Manager",
  "Business Development",
  "Operations Manager",
  "Other",
]

export const projectTypes = [
  "L1 Blockchain",
  "DeFi Protocol",
  "Infrastructure",
  "Gaming",
  "NFT/Culture",
  "Enterprise",
  "Wallet",
  "Bridge",
  "Oracle",
  "Data/Analytics",
  "Developer Tools",
  "Other",
]

export const projectVerticals = [
  "Validator Marketplaces",
  "Virtual Machines",
  "Wallets",
  "Oracles",
  "Interoperability Tools",
  "Cryptography",
  "Bridges",
  "Explorers",
  "RPCs",
  "Data Storage",
  "Indexers",
  "Token Engineering",
  "On & Offramps",
  "DeFi",
  "Gaming",
  "RWAs/Institutional",
  "Culture/NFTs",
  "Enterprise",
  "Exchanges/Wallets",
  "Payments",
  "AI",
  "Other",
]

export const continents = [
  "Africa",
  "Asia",
  "Australia",
  "Europe",
  "North America",
  "South America",
]

export const fundingRanges = [
  "$1-$24,999",
  "$25,000-$49,999",
  "$50,000-$99,999",
  "$100,000-$199,999",
  "$200,000+",
]

export const formSchema = z.object({
  // PROJECT OVERVIEW
  project_name: z.string().min(1, "Project name is required"),
  project_type: z.string().min(1, "Project type is required"),
  project_vertical: z.string().min(1, "Project vertical is required"),
  project_website: z.string().optional(),
  project_x_handle: z.string().optional(),
  project_github: z.string().min(1, "GitHub is required"),
  project_hq: z.string().min(1, "Project HQ is required"),
  project_continent: z.string().min(1, "Continent is required"),
  media_kit: z.string().min(1, "Media kit is required"),

  // FINANCIAL OVERVIEW
  previous_retro9000_snapshot_funding: z.string().optional(),
  requested_funding_range: z.string().min(1, "Funding range is required"),

  // GRANT INFORMATION
  eligibility_and_metrics: z.string().min(1, "This field is required"),
  requested_grant_size_budget: z.string().min(1, "Grant size and budget is required"),
  changes_since_last_snapshot: z.string().min(1, "This field is required"),

  // APPLICANT INFORMATION
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  pseudonym: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  email: z.string().email("Valid email is required"),
  x_account: z.string().min(1, "X account is required"),
  telegram: z.string().min(1, "Telegram is required"),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  country: z.string().optional(),
  other_url: z.string().optional(),
  bio: z.string().min(1, "Bio is required").max(500, "Maximum 500 characters"),

  // COMPLIANCE
  kyb_willing: z.string().min(1, "KYB willingness is required"),
  gdpr: z.boolean().refine((val) => val === true, "You must agree to the privacy policy."),
  marketing_consent: z.boolean().optional(),
})

export type Retro9000ReturningFormData = z.infer<typeof formSchema>
