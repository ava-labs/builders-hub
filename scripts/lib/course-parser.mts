import type { CourseInput, CourseSection, Lesson, LessonType } from '../types/course-schema.mts';

/**
 * Parses course outline input in various formats
 */
export class CourseParser {
  /**
   * Parse text outline format with [T]/[P] markers
   *
   * Expected format:
   * Course: Title
   * Slug: slug-name
   * Description: Description text
   * Icon: IconName
   * Category: Category Name
   * Dependencies: dep1, dep2
   * Authors: author1, author2
   * Position: x=50, y=250
   * MobileOrder: 1
   *
   * Section Title
   * [T] Lesson 1
   * [P] Lesson 2
   */
  parseTextOutline(outline: string): CourseInput {
    const lines = outline.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Parse metadata
    const metadata = this.extractMetadata(lines);

    // Parse sections and lessons
    const sections = this.extractSections(lines);

    return {
      courseSlug: metadata.slug,
      courseTitle: metadata.title,
      description: metadata.description,
      icon: metadata.icon,
      category: metadata.category,
      dependencies: metadata.dependencies,
      position: metadata.position,
      mobileOrder: metadata.mobileOrder,
      authors: metadata.authors,
      sections
    };
  }

  /**
   * Parse JSON input format
   */
  parseJSON(json: any): CourseInput {
    // Validate required fields
    this.validateCourseInput(json);
    return json as CourseInput;
  }

  /**
   * Extract metadata from text outline
   */
  private extractMetadata(lines: string[]): {
    title: string;
    slug: string;
    description: string;
    icon: string;
    category: string;
    dependencies: string[];
    position: { x: number; y: number };
    mobileOrder: number;
    authors: string[];
  } {
    let title = '';
    let slug = '';
    let description = '';
    let icon = 'Book';
    let category = '';
    let dependencies: string[] = [];
    let position = { x: 50, y: 250 };
    let mobileOrder = 9;
    let authors: string[] = [];

    for (const line of lines) {
      if (line.startsWith('Course:')) {
        title = line.replace('Course:', '').trim();
      } else if (line.startsWith('Slug:')) {
        slug = line.replace('Slug:', '').trim();
      } else if (line.startsWith('Description:')) {
        description = line.replace('Description:', '').trim();
      } else if (line.startsWith('Icon:')) {
        icon = line.replace('Icon:', '').trim();
      } else if (line.startsWith('Category:')) {
        category = line.replace('Category:', '').trim();
      } else if (line.startsWith('Dependencies:')) {
        const depsStr = line.replace('Dependencies:', '').trim();
        dependencies = depsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);
      } else if (line.startsWith('Authors:')) {
        const authorsStr = line.replace('Authors:', '').trim();
        authors = authorsStr.split(',').map(a => a.trim()).filter(a => a.length > 0);
      } else if (line.startsWith('Position:')) {
        const posStr = line.replace('Position:', '').trim();
        const xMatch = posStr.match(/x=([0-9.]+)/);
        const yMatch = posStr.match(/y=([0-9.]+)/);
        if (xMatch && yMatch) {
          position = { x: parseFloat(xMatch[1]), y: parseFloat(yMatch[1]) };
        }
      } else if (line.startsWith('MobileOrder:')) {
        mobileOrder = parseInt(line.replace('MobileOrder:', '').trim());
      }
    }

    return {
      title,
      slug,
      description,
      icon,
      category,
      dependencies,
      position,
      mobileOrder,
      authors
    };
  }

  /**
   * Extract sections and lessons from text outline
   */
  private extractSections(lines: string[]): CourseSection[] {
    const sections: CourseSection[] = [];
    let currentSection: CourseSection | null = null;
    let sectionOrder = 0;
    let lessonOrder = 0;
    let inMetadata = true;

    for (const line of lines) {
      // Skip metadata lines
      if (inMetadata) {
        if (line.startsWith('Course:') ||
            line.startsWith('Slug:') ||
            line.startsWith('Description:') ||
            line.startsWith('Icon:') ||
            line.startsWith('Category:') ||
            line.startsWith('Dependencies:') ||
            line.startsWith('Authors:') ||
            line.startsWith('Position:') ||
            line.startsWith('MobileOrder:')) {
          continue;
        } else {
          inMetadata = false;
        }
      }

      // Check if it's a lesson line
      if (line.startsWith('[T]') || line.startsWith('[P]')) {
        if (!currentSection) {
          // Create default section if lesson found without section
          currentSection = {
            title: 'Lessons',
            order: ++sectionOrder,
            lessons: []
          };
          lessonOrder = 0;
        }

        const type: LessonType = line.startsWith('[T]') ? 'theoretical' : 'practical';
        const title = line.replace(/^\[T\]|\[P\]/, '').trim();

        currentSection.lessons.push({
          title,
          type,
          order: ++lessonOrder
        });
      } else if (line.length > 0 && !line.startsWith('Welcome to')) {
        // It's a section title
        if (currentSection) {
          sections.push(currentSection);
        }

        currentSection = {
          title: line,
          order: ++sectionOrder,
          lessons: []
        };
        lessonOrder = 0;
      }
    }

    // Add the last section
    if (currentSection && currentSection.lessons.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Validate course input has required fields
   */
  private validateCourseInput(input: any): void {
    const required = ['courseSlug', 'courseTitle', 'description', 'icon', 'category', 'authors', 'sections'];

    for (const field of required) {
      if (!input[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(input.sections) || input.sections.length === 0) {
      throw new Error('Course must have at least one section');
    }

    for (const section of input.sections) {
      if (!section.title || !section.lessons || section.lessons.length === 0) {
        throw new Error(`Section "${section.title || 'unnamed'}" must have at least one lesson`);
      }
    }
  }

  /**
   * Slugify a string (convert to kebab-case)
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
