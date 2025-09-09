import { AssignBadgeBody, AssignBadgeResult, BadgeCategory } from "./badge";

/**
 * Strategy interface for badge assignment
 */
export interface BadgeAssignmentStrategy {
  assignBadge(body: AssignBadgeBody, awardedBy?: string): Promise<AssignBadgeResult>;
  getRequiredRole(): string | null;
}

/**
 * Strategy for Academy badges
 */
export class AcademyBadgeStrategy implements BadgeAssignmentStrategy {
  async assignBadge(body: AssignBadgeBody, awardedBy?: string): Promise<AssignBadgeResult> {
    // Import the existing academy badge logic
    const { assignBadgeAcademy } = await import("./badge");
    
    // Use the existing service
    return await assignBadgeAcademy(body);
  }

  getRequiredRole(): string | null {
    // Academy badges can be assigned by any authenticated user
    return null;
  }
}



/**
 * Strategy for Project badges
 */
export class ProjectBadgeStrategy implements BadgeAssignmentStrategy {
  async assignBadge(body: AssignBadgeBody, awardedBy?: string): Promise<AssignBadgeResult> {
    // Import the existing project badge logic
    const { assignBadgeProject } = await import("./project-badge");
    
    // Use the existing service with provided awardedBy or "system" as fallback
    return await assignBadgeProject(body, awardedBy || "system");
  }

  getRequiredRole(): string | null {
    // Project badges require hackathon_judge role
    return "hackathon_judge";
  }
}

/**
 * Factory to create badge assignment strategies
 */
export class BadgeStrategyFactory {
  public static createStrategy(category: BadgeCategory): BadgeAssignmentStrategy {
    switch (category) {
      case BadgeCategory.academy:
        return new AcademyBadgeStrategy();
      case BadgeCategory.project:
        return new ProjectBadgeStrategy();
      default:
        throw new Error(`Unsupported badge category: ${category}`);
    }
  }
}

/**
 * Main context that uses the Strategy pattern
 */
export class BadgeAssignmentContext {
  private strategy: BadgeAssignmentStrategy;

  constructor(strategy: BadgeAssignmentStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: BadgeAssignmentStrategy): void {
    this.strategy = strategy;
  }

  async assignBadge(body: AssignBadgeBody, awardedBy?: string): Promise<AssignBadgeResult> {
    return await this.strategy.assignBadge(body, awardedBy);
  }
}
