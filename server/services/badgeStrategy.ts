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
    return "badge_admin";
  }
}

/**
 * Strategy for Social badges
 */
export class BadgeByRequirementStrategy implements BadgeAssignmentStrategy {
  async assignBadge(body: AssignBadgeBody, awardedBy?: string): Promise<AssignBadgeResult> {
    // Import the social badge logic
    const { assignBadgeByRequirement } = await import("./socialBadge");
    
    // Validate that requirementId is provided
    if (!body.requirementId) {
      return {
        success: false,
        message: "Requirement ID is required for social badges",
        badge_id: "",
        user_id: body.userId,
        badges: [],
      };
    }
    
    // Assign social badges based on requirement
    const result = await assignBadgeByRequirement(
      body.userId, 
      body.requirementId, 
      awardedBy || "system"
    );
    
    return {
      success: result.success,
      message: result.message,
      badge_id: result.badges.length > 0 ? result.badges[0].name : "",
      user_id: body.userId,
      badges: result.badges,
    };
  }

  getRequiredRole(): string | null {
    return null;
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
      case BadgeCategory.requirement:
        return new BadgeByRequirementStrategy();
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
