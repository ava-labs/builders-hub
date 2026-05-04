export function hasAnyAttribute(
  attributes: string[] | undefined | null,
  allowedAttributes: string[]
): boolean {
  return allowedAttributes.some((attribute) => attributes?.includes(attribute));
}

export function canAccessEvaluationTools(
  attributes: string[] | undefined | null
): boolean {
  return hasAnyAttribute(attributes, ["devrel", "judge"]);
}

export function canGenerateReferralLinks(
  attributes: string[] | undefined | null
): boolean {
  return canAccessEvaluationTools(attributes);
}
