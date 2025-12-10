import * as fs from 'fs/promises';
import * as path from 'path';
import type { CourseInput, CourseSection } from '../types/course-schema.mts';
import { TemplateEngine } from './templates.mts';
import { CourseParser } from './course-parser.mts';

/**
 * Generates course file structure and content
 */
export class FileGenerator {
  private basePath: string;
  private templateEngine: TemplateEngine;

  constructor(basePath: string = '/Users/nicolas.arnedo/builders-hub/content/academy/avalanche-l1') {
    this.basePath = basePath;
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate complete course structure
   */
  async generateCourseStructure(course: CourseInput): Promise<string[]> {
    const createdFiles: string[] = [];
    const coursePath = path.join(this.basePath, course.courseSlug);

    // Create course directory
    await fs.mkdir(coursePath, { recursive: true });
    console.log(`Created course directory: ${coursePath}`);

    // Generate meta.json
    const metaPath = path.join(coursePath, 'meta.json');
    const metaContent = JSON.stringify(this.templateEngine.generateMetaJson(course), null, 2);
    await fs.writeFile(metaPath, metaContent);
    createdFiles.push(metaPath);
    console.log(`✓ Created meta.json`);

    // Generate index.mdx
    const indexPath = path.join(coursePath, 'index.mdx');
    const indexContent = this.templateEngine.generateIndexMdx(course);
    await fs.writeFile(indexPath, indexContent);
    createdFiles.push(indexPath);
    console.log(`✓ Created index.mdx`);

    // Generate certificate.mdx
    const certPath = path.join(coursePath, 'certificate.mdx');
    const certContent = this.templateEngine.generateCertificateMdx(course);
    await fs.writeFile(certPath, certContent);
    createdFiles.push(certPath);
    console.log(`✓ Created certificate.mdx`);

    // Generate sections and lessons
    for (const section of course.sections) {
      const sectionFiles = await this.generateSection(coursePath, section, course);
      createdFiles.push(...sectionFiles);
    }

    return createdFiles;
  }

  /**
   * Generate a section directory with lessons
   */
  private async generateSection(
    coursePath: string,
    section: CourseSection,
    course: CourseInput
  ): Promise<string[]> {
    const createdFiles: string[] = [];
    const sectionSlug = this.getSectionSlug(section);
    const sectionPath = path.join(coursePath, sectionSlug);

    // Create section directory
    await fs.mkdir(sectionPath, { recursive: true });
    console.log(`✓ Created section: ${sectionSlug}/`);

    // Generate lessons
    for (const lesson of section.lessons) {
      const lessonSlug = this.templateEngine.getLessonSlug(lesson);
      const lessonPath = path.join(sectionPath, lessonSlug);
      const lessonContent = this.templateEngine.generateLessonMdx(lesson, course, section.order);

      await fs.writeFile(lessonPath, lessonContent);
      createdFiles.push(lessonPath);
      console.log(`  ✓ Created lesson: ${sectionSlug}/${lessonSlug}`);
    }

    return createdFiles;
  }

  /**
   * Get section slug
   */
  private getSectionSlug(section: CourseSection): string {
    const orderStr = String(section.order).padStart(2, '0');
    const titleSlug = CourseParser.slugify(section.title);
    return `${orderStr}-${titleSlug}`;
  }

  /**
   * Check if course already exists
   */
  async courseExists(courseSlug: string): Promise<boolean> {
    const coursePath = path.join(this.basePath, courseSlug);
    try {
      await fs.access(coursePath);
      return true;
    } catch {
      return false;
    }
  }
}
