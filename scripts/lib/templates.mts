import type { CourseInput, CourseSection, Lesson } from '../types/course-schema.mts';
import { CourseParser } from './course-parser.mts';

/**
 * Generates content templates for course files
 */
export class TemplateEngine {
  /**
   * Generate meta.json for course navigation
   */
  generateMetaJson(course: CourseInput): object {
    const pages: string[] = ['index'];

    // Add section dividers and folder expansions
    for (const section of course.sections) {
      pages.push(`---${section.title}---`);
      const sectionSlug = this.getSectionSlug(section);
      pages.push(`...${sectionSlug}`);
    }

    // Add certificate at the end
    pages.push('certificate');

    return {
      title: course.courseTitle,
      icon: course.icon,
      root: true,
      pages
    };
  }

  /**
   * Generate index.mdx for course landing page
   */
  generateIndexMdx(course: CourseInput): string {
    const today = new Date().toISOString().split('T')[0];

    return `---
title: Welcome to the Course
description: ${course.description}
updated: ${today}
authors: [${course.authors.join(', ')}]
icon: Smile
---

## Why Take This Course?

[PLACEHOLDER: Add course motivation and context. Explain why this course is valuable and what problems it solves.]

## Course Content

[PLACEHOLDER: Add course content overview. Consider using a Steps component to outline the major sections:]

import { Steps, Step } from 'fumadocs-ui/components/steps';

<Steps>
  <Step>
    ### Section 1
    Description of what students will learn
  </Step>
  <Step>
    ### Section 2
    Description of what students will learn
  </Step>
</Steps>

## Prerequisites

[PLACEHOLDER: Add prerequisites. For example:]

Before starting this course, you should be familiar with:
- Prerequisite 1
- Prerequisite 2
- Prerequisite 3

## Learning Outcomes

By the end of this course, you will be able to:

- [PLACEHOLDER: Learning outcome 1]
- [PLACEHOLDER: Learning outcome 2]
- [PLACEHOLDER: Learning outcome 3]
- [PLACEHOLDER: Learning outcome 4]
`;
  }

  /**
   * Generate certificate.mdx for course completion
   */
  generateCertificateMdx(course: CourseInput): string {
    const today = new Date().toISOString().split('T')[0];

    return `---
title: Course Completion Certificate
description: Get your completion certificate for the ${course.courseTitle} course
updated: ${today}
authors: [${course.authors.join(', ')}]
icon: BadgeCheck
---

import CertificatePage from '@/components/quizzes/certificates';

You've made it to the end of the course! Let's check your progress and get your certificate.

<CertificatePage courseId="${course.courseSlug}"/>

Thank you for participating in this course. We hope you found it informative and enjoyable!
`;
  }

  /**
   * Generate lesson MDX file
   */
  generateLessonMdx(lesson: Lesson, course: CourseInput, sectionOrder: number): string {
    const today = new Date().toISOString().split('T')[0];
    const icon = lesson.icon || (lesson.type === 'practical' ? 'Terminal' : 'Book');
    const descriptionPrefix = lesson.type === 'practical' ? 'Hands-on exercise: ' : 'Learn about ';

    const frontmatter = `---
title: ${lesson.title}
description: ${descriptionPrefix}${lesson.title}
updated: ${today}
authors: [${course.authors.join(', ')}]
icon: ${icon}
---

`;

    const content = lesson.type === 'practical'
      ? this.generatePracticalContent(lesson)
      : this.generateTheoreticalContent(lesson);

    return frontmatter + content;
  }

  /**
   * Generate content template for theoretical lessons
   */
  private generateTheoreticalContent(lesson: Lesson): string {
    return `## Overview

[PLACEHOLDER: Add an overview of ${lesson.title}. Provide context and explain why this topic is important.]

## Key Concepts

[PLACEHOLDER: Add key concepts and definitions. Break down the main ideas that students need to understand:]

- **Concept 1**: Definition and explanation
- **Concept 2**: Definition and explanation
- **Concept 3**: Definition and explanation

## Deep Dive

[PLACEHOLDER: Provide detailed explanation of ${lesson.title}. Include:]

- Technical details
- How it works
- Architecture or design patterns
- Visual diagrams (if applicable)
- Example scenarios

### Subtopic 1

[PLACEHOLDER: Add detailed content]

### Subtopic 2

[PLACEHOLDER: Add detailed content]

## Summary

[PLACEHOLDER: Summarize the key takeaways from this lesson. What should students remember?]

Key points:
- [PLACEHOLDER: Key point 1]
- [PLACEHOLDER: Key point 2]
- [PLACEHOLDER: Key point 3]
`;
  }

  /**
   * Generate content template for practical lessons
   */
  private generatePracticalContent(lesson: Lesson): string {
    return `## Objectives

By the end of this exercise, you will be able to:

- [PLACEHOLDER: Objective 1]
- [PLACEHOLDER: Objective 2]
- [PLACEHOLDER: Objective 3]

## Prerequisites

Before starting this exercise, ensure you have:

- [PLACEHOLDER: Prerequisite 1]
- [PLACEHOLDER: Prerequisite 2]
- [PLACEHOLDER: Prerequisite 3]

## Instructions

import { Steps, Step } from 'fumadocs-ui/components/steps';

<Steps>
  <Step>
    ### Step 1: [PLACEHOLDER: Step Title]

    [PLACEHOLDER: Detailed instructions for step 1]

    \`\`\`bash
    # Example command
    [PLACEHOLDER: Add command]
    \`\`\`
  </Step>

  <Step>
    ### Step 2: [PLACEHOLDER: Step Title]

    [PLACEHOLDER: Detailed instructions for step 2]

    \`\`\`typescript
    // Example code
    [PLACEHOLDER: Add code]
    \`\`\`
  </Step>

  <Step>
    ### Step 3: [PLACEHOLDER: Step Title]

    [PLACEHOLDER: Detailed instructions for step 3]
  </Step>
</Steps>

## Expected Output

[PLACEHOLDER: Describe what students should see or achieve after completing this exercise. Include screenshots or example output if applicable.]

\`\`\`
[PLACEHOLDER: Example output]
\`\`\`

## Verification

To verify you've completed this exercise successfully:

1. [PLACEHOLDER: Verification step 1]
2. [PLACEHOLDER: Verification step 2]

## Troubleshooting

[PLACEHOLDER: Add common issues and solutions]

### Issue 1: [PLACEHOLDER]

**Problem**: [PLACEHOLDER: Describe the problem]

**Solution**: [PLACEHOLDER: Describe the solution]

### Issue 2: [PLACEHOLDER]

**Problem**: [PLACEHOLDER: Describe the problem]

**Solution**: [PLACEHOLDER: Describe the solution]

## Next Steps

[PLACEHOLDER: Suggest what students should do next or additional resources to explore]
`;
  }

  /**
   * Get section slug from section object
   */
  private getSectionSlug(section: CourseSection): string {
    const orderStr = String(section.order).padStart(2, '0');
    const titleSlug = CourseParser.slugify(section.title);
    return `${orderStr}-${titleSlug}`;
  }

  /**
   * Get lesson slug from lesson object
   */
  getLessonSlug(lesson: Lesson): string {
    const orderStr = String(lesson.order).padStart(2, '0');
    const titleSlug = CourseParser.slugify(lesson.title);
    return `${orderStr}-${titleSlug}.mdx`;
  }
}
