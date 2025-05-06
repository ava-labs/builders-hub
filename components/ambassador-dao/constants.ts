export const statusOptions = [
  { id: "OPEN", label: "Open" },
  { id: "IN_REVIEW", label: "In Review" },
  { id: "COMPLETED", label: "Completed" },
];

export const jobTypes = [
  { id: "PUBLIC", label: "All" },
  { id: "AMBASSADOR_SPECIFIC", label: "Ambassador" },
];

export const sortOrderTypes = [
  { id: "desc", label: "Most Recent" },
  { id: "asc", label: "Oldest First" },
  { id: "lowest_paying", label: "Lowest Paying" },
  { id: "ending_soon", label: "Ending Soon" },
  { id: "most_popular", label: "Most Popular" },
  { id: "least_popular", label: "Least Popular" },
];


export const budgetRange = [
  { id: "1-5000", label: "1-5000" },
  { id: "5001-10000", label: "5001-10000" },
];

export const categories = [
  { id: "JOB", label: "Job" },
  { id: "BOUNTY", label: "Bounty" },
];

export const opportunityApplicationStatusOptions = [
  { value: "ALL", label: "Everything" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPROVED", label: "Approved" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "APPLIED", label: "Pending Review" },
];

export const opportunitySubmissionStatusOptions = [
  { value: "ALL", label: "Everything" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REWARDED", label: "Rewarded" },
];
