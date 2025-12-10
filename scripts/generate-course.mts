#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CourseParser } from './lib/course-parser.mts';
import { FileGenerator } from './lib/file-generator.mts';
import { RegistryUpdater } from './lib/registry-updater.mts';
import type { CourseInput } from './types/course-schema.mts';

const program = new Command();

program
  .name('generate-course')
  .description('Generate academy course structure from outline')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new course from input file')
  .requiredOption('-i, --input <file>', 'Input file (text outline or JSON)')
  .option('--skip-registry', 'Skip updating registry files', false)
  .option('--force', 'Overwrite existing course if it exists', false)
  .action(async (options) => {
    try {
      console.log('\n🚀 Academy Course Generator\n');

      // Initialize components
      const parser = new CourseParser();
      const generator = new FileGenerator();
      const registryUpdater = new RegistryUpdater();

      // Read input file
      console.log(`📖 Reading input file: ${options.input}`);
      const inputPath = path.resolve(options.input);
      const content = await fs.readFile(inputPath, 'utf-8');

      // Parse input
      let courseInput: CourseInput;
      if (options.input.endsWith('.json')) {
        console.log('📝 Parsing JSON input...');
        courseInput = parser.parseJSON(JSON.parse(content));
      } else {
        console.log('📝 Parsing text outline...');
        courseInput = parser.parseTextOutline(content);
      }

      console.log(`\n✅ Parsed course: "${courseInput.courseTitle}"`);
      console.log(`   Slug: ${courseInput.courseSlug}`);
      console.log(`   Sections: ${courseInput.sections.length}`);
      console.log(`   Lessons: ${courseInput.sections.reduce((sum, s) => sum + s.lessons.length, 0)}`);

      // Check if course exists
      const exists = await generator.courseExists(courseInput.courseSlug);
      if (exists && !options.force) {
        console.error(`\n❌ Error: Course "${courseInput.courseSlug}" already exists.`);
        console.error('   Use --force to overwrite, or choose a different slug.');
        process.exit(1);
      }

      if (exists && options.force) {
        console.log(`\n⚠️  Warning: Overwriting existing course "${courseInput.courseSlug}"`);
      }

      // Generate course structure
      console.log('\n📁 Generating course structure...\n');
      const createdFiles = await generator.generateCourseStructure(courseInput);

      // Update registries
      if (!options.skipRegistry) {
        console.log('\n📋 Updating registry files...');
        await registryUpdater.updateAcademyMeta(courseInput.courseSlug);
        await registryUpdater.updateLearningPathConfig(courseInput);
      } else {
        console.log('\n⏭️  Skipping registry updates (--skip-registry flag)');
      }

      // Success report
      console.log('\n✅ Course structure created successfully!\n');
      console.log('📊 Summary:');
      console.log(`   Course: ${courseInput.courseTitle}`);
      console.log(`   Location: /content/academy/avalanche-l1/${courseInput.courseSlug}/`);
      console.log(`   Files created: ${createdFiles.length}`);
      console.log(`   Sections: ${courseInput.sections.length}`);
      console.log(`   Lessons: ${courseInput.sections.reduce((sum, s) => sum + s.lessons.length, 0)}`);

      console.log('\n📝 Next steps:');
      console.log('   1. Review generated files and fill in [PLACEHOLDER] content');
      console.log('   2. Add course images to /public/common-images/ if needed');
      console.log('   3. Update lesson content with actual material');
      console.log('   4. Test navigation: npm run dev');
      console.log(`   5. Visit: http://localhost:3000/academy/avalanche-l1/${courseInput.courseSlug}`);
      console.log('\n✨ Happy course building!\n');

    } catch (error) {
      console.error('\n❌ Error generating course:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
