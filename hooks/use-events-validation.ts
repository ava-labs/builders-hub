// hooks/use-events-validation.ts
import { FieldErrors } from 'react-hook-form';
import { HackathonEditFormValues } from '@/lib/hackathons/hackathon-edit.schema';
import { resolveFieldLabel } from '@/lib/events-field-labels';

export type ValidationIssue = {
  path: string;
  message: string;
  label: string;
  section: string;
};

export function useEventsValidation(
  onErrors: (issues: ValidationIssue[]) => void,
  language: 'en' | 'es'
) {
  const getValidationIssues = (
    validationErrors: FieldErrors<HackathonEditFormValues>
  ): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    const visit = (node: unknown, currentPath: string): void => {
      if (!node || typeof node !== 'object') return;
      const nodeRecord = node as Record<string, unknown>;

      if (typeof nodeRecord.message === 'string' && nodeRecord.message.trim()) {
        const { label, section } = resolveFieldLabel(currentPath);
        issues.push({ path: currentPath, message: nodeRecord.message, label, section });
      }

      Object.entries(nodeRecord).forEach(([key, value]) => {
        if (key === 'message' || key === 'type' || key === 'ref') return;
        const nextPath = currentPath ? `${currentPath}.${key}` : key;
        visit(value, nextPath);
      });
    };

    visit(validationErrors, '');
    return issues;
  };

  const onValidationError = (errors: FieldErrors<HackathonEditFormValues>): void => {
    const allIssues = getValidationIssues(errors);
    onErrors(allIssues);
  };

  return { getValidationIssues, onValidationError };
}