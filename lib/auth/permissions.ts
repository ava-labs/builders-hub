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

export function canAccessBuilderInsights(
  attributes: string[] | undefined | null
): boolean {
  // Per the BuilderHub roles sheet, Builder Hub Insights is visible to
  // DevRel and the entire Team One hierarchy (admin / member / technical).
  // The legacy `builder_insights` tag remains supported for ad-hoc grants
  // outside that group (foundation reviewers, etc.).
  return hasAnyAttribute(attributes, [
    "builder_insights",
    "devrel",
    "team1-admin",
    "team1-member",
    "team1-technical",
  ]);
}

export function canSendNotifications(
  attributes: string[] | undefined | null
): boolean {
  return hasAnyAttribute(attributes, ["devrel"]);
}

export function canGenerateRestrictedReferralLinks(
  attributes: string[] | undefined | null
): boolean {
  return canAccessBuilderInsights(attributes);
}

export function canGenerateReferralLinkForTarget(
  _attributes: string[] | undefined | null,
  targetType: string
): boolean {
  if (targetType === "build_games_application") return false;
  return true;
}
