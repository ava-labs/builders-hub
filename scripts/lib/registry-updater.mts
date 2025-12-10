import * as fs from 'fs/promises';
import type { CourseInput } from '../types/course-schema.mts';

/**
 * Updates registry files to register new courses
 */
export class RegistryUpdater {
  private academyMetaPath: string;
  private learningPathConfigPath: string;

  constructor(
    academyMetaPath: string = '/Users/nicolas.arnedo/builders-hub/content/academy/avalanche-l1/meta.json',
    learningPathConfigPath: string = '/Users/nicolas.arnedo/builders-hub/components/academy/learning-path-configs/avalanche.config.ts'
  ) {
    this.academyMetaPath = academyMetaPath;
    this.learningPathConfigPath = learningPathConfigPath;
  }

  /**
   * Update academy meta.json to add course
   */
  async updateAcademyMeta(courseSlug: string): Promise<void> {
    // Read existing meta.json
    const metaContent = await fs.readFile(this.academyMetaPath, 'utf-8');
    const meta = JSON.parse(metaContent);

    // Check if course already exists
    if (meta.pages.includes(courseSlug)) {
      console.log(`⚠ Course "${courseSlug}" already exists in academy meta.json`);
      return;
    }

    // Add course slug to pages array
    meta.pages.push(courseSlug);

    // Write back formatted JSON
    await fs.writeFile(this.academyMetaPath, JSON.stringify(meta, null, 2) + '\n');
    console.log(`✓ Added "${courseSlug}" to academy meta.json`);
  }

  /**
   * Update learning path config to add CourseNode
   */
  async updateLearningPathConfig(course: CourseInput): Promise<void> {
    // Read existing config
    let config = await fs.readFile(this.learningPathConfigPath, 'utf-8');

    // Check if course already exists
    if (config.includes(`id: "${course.courseSlug}"`)) {
      console.log(`⚠ Course "${course.courseSlug}" already exists in learning path config`);
      return;
    }

    // Generate CourseNode
    const courseNode = this.generateCourseNode(course);

    // Find the closing bracket of avalancheLearningPaths array
    const closingBracketIndex = config.lastIndexOf('];');

    if (closingBracketIndex === -1) {
      throw new Error('Could not find closing bracket of avalancheLearningPaths array');
    }

    // Check if we need a comma before the new entry
    const beforeClosing = config.substring(0, closingBracketIndex).trimEnd();
    const needsComma = beforeClosing.endsWith('}');

    // Insert the new course node
    const insertion = needsComma ? ',\n' + courseNode : '\n' + courseNode;
    config = config.slice(0, closingBracketIndex) + insertion + '\n' + config.slice(closingBracketIndex);

    // Write back the updated config
    await fs.writeFile(this.learningPathConfigPath, config);
    console.log(`✓ Added "${course.courseSlug}" to learning path config`);
  }

  /**
   * Generate CourseNode TypeScript code
   */
  private generateCourseNode(course: CourseInput): string {
    const dependencies = course.dependencies && course.dependencies.length > 0
      ? `\n        dependencies: [${course.dependencies.map(d => `"${d}"`).join(', ')}],`
      : '';

    return `    {
        id: "${course.courseSlug}",
        name: "${course.courseTitle}",
        description: "${course.description}",
        slug: "avalanche-l1/${course.courseSlug}",
        category: "${course.category}",${dependencies}
        position: { x: ${course.position.x}, y: ${course.position.y} },
        mobileOrder: ${course.mobileOrder}
    }`;
  }

  /**
   * Rollback academy meta changes
   */
  async rollbackAcademyMeta(courseSlug: string): Promise<void> {
    const metaContent = await fs.readFile(this.academyMetaPath, 'utf-8');
    const meta = JSON.parse(metaContent);

    meta.pages = meta.pages.filter((page: string) => page !== courseSlug);

    await fs.writeFile(this.academyMetaPath, JSON.stringify(meta, null, 2) + '\n');
    console.log(`✓ Removed "${courseSlug}" from academy meta.json`);
  }
}
