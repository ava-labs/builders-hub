"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExportSettings } from "../types";

const STORAGE_KEY = "image-export-custom-templates";
const MAX_TEMPLATES = 5;

export interface CustomTemplate {
  id: string;
  name: string;
  settings: ExportSettings;
  createdAt: number;
}

export function useCustomTemplates() {
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Clear storage error after it's been shown
  const clearStorageError = useCallback(() => setStorageError(null), []);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTemplates(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load custom templates:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
        setStorageError(null);
      } catch (error) {
        console.error("Failed to save custom templates:", error);
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          setStorageError("Storage full. Unable to save templates.");
        } else {
          setStorageError("Failed to save templates to storage.");
        }
      }
    }
  }, [templates, isLoaded]);

  const saveTemplate = useCallback((name: string, settings: ExportSettings) => {
    const newTemplate: CustomTemplate = {
      id: `custom-${Date.now()}`,
      name: name.trim() || `Template ${templates.length + 1}`,
      settings: { ...settings, preset: "customize" },
      createdAt: Date.now(),
    };

    setTemplates((prev) => {
      // If at max, remove oldest
      const updated = prev.length >= MAX_TEMPLATES
        ? [...prev.slice(1), newTemplate]
        : [...prev, newTemplate];
      return updated;
    });

    return newTemplate.id;
  }, [templates.length]);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const renameTemplate = useCallback((id: string, newName: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, name: newName.trim() || t.name } : t
      )
    );
  }, []);

  const updateTemplate = useCallback((id: string, settings: ExportSettings) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, settings: { ...settings, preset: "customize" } } : t
      )
    );
  }, []);

  const duplicateTemplate = useCallback((id: string) => {
    const original = templates.find((t) => t.id === id);
    if (!original) return null;

    // Check if we can add more templates
    if (templates.length >= MAX_TEMPLATES) {
      return null;
    }

    const newTemplate: CustomTemplate = {
      id: `custom-${Date.now()}`,
      name: `${original.name} (Copy)`,
      settings: { ...original.settings },
      createdAt: Date.now(),
    };

    setTemplates((prev) => [...prev, newTemplate]);
    return newTemplate.id;
  }, [templates]);

  const getTemplate = useCallback((id: string) => {
    return templates.find((t) => t.id === id);
  }, [templates]);

  // Export a single template as JSON string
  const exportTemplate = useCallback((id: string): string | null => {
    const template = templates.find((t) => t.id === id);
    if (!template) return null;

    const exportData = {
      version: 1,
      type: "image-studio-templates",
      exportedAt: new Date().toISOString(),
      templates: [{ name: template.name, settings: template.settings }],
    };
    return JSON.stringify(exportData, null, 2);
  }, [templates]);

  // Export all templates as JSON string
  const exportAllTemplates = useCallback((): string => {
    const exportData = {
      version: 1,
      type: "image-studio-templates",
      exportedAt: new Date().toISOString(),
      templates: templates.map((t) => ({ name: t.name, settings: t.settings })),
    };
    return JSON.stringify(exportData, null, 2);
  }, [templates]);

  // Import templates from JSON string
  const importTemplates = useCallback((json: string): { success: number; failed: number; error?: string } => {
    try {
      const data = JSON.parse(json);

      // Validate structure
      if (data.type !== "image-studio-templates") {
        return { success: 0, failed: 0, error: "Invalid file format" };
      }

      if (data.version !== 1) {
        return { success: 0, failed: 0, error: "File version not supported" };
      }

      if (!Array.isArray(data.templates) || data.templates.length === 0) {
        return { success: 0, failed: 0, error: "No templates found in file" };
      }

      let success = 0;
      let failed = 0;

      const newTemplates: CustomTemplate[] = [];

      for (const importedTemplate of data.templates) {
        // Validate template has required fields
        if (!importedTemplate.name || !importedTemplate.settings) {
          failed++;
          continue;
        }

        // Check for duplicate names and add suffix if needed
        let name = importedTemplate.name;
        const existingNames = [...templates, ...newTemplates].map((t) => t.name);
        if (existingNames.includes(name)) {
          name = `${name} (imported)`;
          // If still duplicate, add number
          let counter = 2;
          while (existingNames.includes(name)) {
            name = `${importedTemplate.name} (imported ${counter})`;
            counter++;
          }
        }

        newTemplates.push({
          id: `custom-${Date.now()}-${success}`,
          name,
          settings: { ...importedTemplate.settings, preset: "customize" },
          createdAt: Date.now(),
        });
        success++;
      }

      // Add new templates (respecting max limit)
      setTemplates((prev) => {
        const combined = [...prev, ...newTemplates];
        // Keep only the most recent MAX_TEMPLATES
        return combined.slice(-MAX_TEMPLATES);
      });

      return { success, failed };
    } catch {
      return { success: 0, failed: 0, error: "Invalid JSON format" };
    }
  }, [templates]);

  return {
    templates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate,
    getTemplate,
    exportTemplate,
    exportAllTemplates,
    importTemplates,
    isLoaded,
    canSaveMore: templates.length < MAX_TEMPLATES,
    storageError,
    clearStorageError,
  };
}
