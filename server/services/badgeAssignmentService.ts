import { AssignBadgeBody, AssignBadgeResult, BadgeCategory } from "./badge";
import { BadgeAssignmentContext, BadgeStrategyFactory } from "./badgeStrategy";

export class BadgeAssignmentService {
  private context: BadgeAssignmentContext;

  constructor() {
    // Initialize with a default strategy (will be changed dynamically)
    this.context = new BadgeAssignmentContext(
      BadgeStrategyFactory.createStrategy(BadgeCategory.academy)
    );
  }

  /**
   * Assigns a badge based on the category specified in the body
   * @param body - Badge assignment data
   * @param awardedBy - User who is awarding the badge (optional)
   * @returns Assignment result
   */
  async assignBadge(
    body: AssignBadgeBody,
    awardedBy?: string
  ): Promise<AssignBadgeResult> {
    try {
      // Determine the badge category
      const category = this.determineBadgeCategory(body);

      if (category === null) {
        return {
          success: false,
          message:
            "Unable to determine badge category. Please provide courseId, hackathonId, or projectId",
          badge_id: "",
          user_id: body.userId,
          badges: [],
        };
      }

      // Create the appropriate strategy
      const strategy = BadgeStrategyFactory.createStrategy(category);
      this.context.setStrategy(strategy);

      // Execute the assignment using the selected strategy
      return await this.context.assignBadge(body, awardedBy);
    } catch (error) {
      console.error("Error in BadgeAssignmentService:", error);
      return {
        success: false,
        message: `Error assigning badge: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        badge_id: "",
        user_id: body.userId,
        badges: [],
      };
    }
  }

  /**
   * Assigns a badge using a specific strategy
   * @param body - Badge assignment data
   * @param category - Specific badge category
   * @param awardedBy - User who is awarding the badge (optional)
   * @returns Assignment result
   */
  async assignBadgeWithCategory(
    body: AssignBadgeBody,
    category: BadgeCategory,
    awardedBy?: string
  ): Promise<AssignBadgeResult> {
    try {
      // Create the specific strategy
      const strategy = BadgeStrategyFactory.createStrategy(category);
      this.context.setStrategy(strategy);

      // Execute the assignment
      return await this.context.assignBadge(body, awardedBy);
    } catch (error) {
      console.error("Error in BadgeAssignmentService with category:", error);
      return {
        success: false,
        message: `Error assigning badge: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        badge_id: "",
        user_id: body.userId,
        badges: [],
      };
    }
  }

  /**
   * Determines the badge category based on the body data
   * @param body - Badge assignment data
   * @returns Badge category or null if cannot be determined
   */
  private determineBadgeCategory(body: AssignBadgeBody): BadgeCategory | null {
    // If category is already specified, use it

    if (body.category !== undefined) {
      return body.category;
    }

    // Determine category based on provided IDs
    if (body.courseId) {
      return BadgeCategory.academy;
    }

    if (body.projectId) {
      return BadgeCategory.project;
    }

    return BadgeCategory.requirement;
  }

  /**
   * Gets all available badge categories
   * @returns Array of available categories
   */
  getAvailableCategories(): BadgeCategory[] {
    return Object.values(BadgeCategory).filter(
      (value) => typeof value === "number"
    ) as BadgeCategory[];
  }

  /**
   * Validates if a body has the required data for a specific category
   * @param body - Badge assignment data
   * @param category - Category to validate
   * @returns true if the body is valid for the category
   */
  validateBodyForCategory(
    body: AssignBadgeBody,
    category: BadgeCategory
  ): boolean {
    switch (category) {
      case BadgeCategory.academy:
        return !!(body.userId && body.courseId);
      case BadgeCategory.project:
        return !!(body.userId && body.projectId);

      default:
        return false;
    }
  }

  /**
   * Gets the required role for a specific badge category
   * @param category - Badge category
   * @returns Required role or null if no role required
   */
  getRequiredRoleForCategory(category: BadgeCategory): string | null {
    const strategy = BadgeStrategyFactory.createStrategy(category);
    return strategy.getRequiredRole();
  }

  /**
   * Gets the required role for a badge assignment based on body data
   * @param body - Badge assignment data
   * @returns Required role or null if no role required
   */
  getRequiredRoleForAssignment(body: AssignBadgeBody): string | null {
    const category = this.determineBadgeCategory(body);
    if (!category) {
      return null;
    }
    return this.getRequiredRoleForCategory(category);
  }

  /**
   * Checks if a user has the required role for a badge assignment
   * @param body - Badge assignment data
   * @param userRole - User's role
   * @returns true if user has required role
   */
  hasRequiredRole(body: AssignBadgeBody, roles: string[]): boolean {
    const requiredRole = this.getRequiredRoleForAssignment(body);
    if (!requiredRole) {
      return true; // No role required
    }
    return roles.includes(requiredRole);
  }
}

// Singleton instance of the service
export const badgeAssignmentService = new BadgeAssignmentService();
