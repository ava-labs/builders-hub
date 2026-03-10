import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

export type DetectedContentType = "text/plain" | "text/markdown" | "text/html";

export type NotificationContentIssue =
  | "script-tag"
  | "unsafe-html"
  | "unsafe-url"
  | "event-handler"
  | "forbidden-tag"
  | "content-modified-by-sanitizer";

export type NotificationContentGuardResult = {
  detectedType: DetectedContentType;
  originalContent: string;
  sanitizedContent: string;
  isSafe: boolean;
  issues: NotificationContentIssue[];
};

const HTML_PATTERN: RegExp =
  /<([a-z][a-z0-9-]*)(\s[^>]*)?>[\s\S]*<\/\1>|<([a-z][a-z0-9-]*)(\s[^>]*)?\/?>/i;

const MARKDOWN_PATTERN: RegExp =
  /^(#{1,6}\s.+|>\s.+|[-*+]\s.+|\d+\.\s.+|```[\s\S]*```|`[^`]+`|\[.+\]\(.+\)|!\[.*\]\(.+\)|\*\*.+\*\*|__.+__|\*.+\*|_.+_)$/m;

const SCRIPT_TAG_PATTERN: RegExp =
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

const EVENT_HANDLER_PATTERN: RegExp =
  /\son[a-z]+\s*=\s*(['"]).*?\1/gi;

const JAVASCRIPT_URL_PATTERN: RegExp =
  /javascript\s*:/gi;

const DATA_HTML_PATTERN: RegExp =
  /data\s*:\s*text\/html/gi;

function detectContentType(content: string): DetectedContentType {
  const trimmed: string = content.trim();

  if (!trimmed) {
    return "text/plain";
  }

  if (HTML_PATTERN.test(trimmed)) {
    return "text/html";
  }

  if (MARKDOWN_PATTERN.test(trimmed)) {
    return "text/markdown";
  }

  return "text/plain";
}

function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },

    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "link",
      "meta",
      "base",
    ],

    FORBID_ATTR: [
      "onerror",
      "onclick",
      "onload",
      "onmouseover",
      "onfocus",
      "onmouseenter",
      "onmouseleave",
      "style",
    ],

    ALLOW_DATA_ATTR: false,
  });
}

function sanitizePlain(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

function collectIssues(original: string, sanitized: string): NotificationContentIssue[] {
  const issues: Set<NotificationContentIssue> = new Set();

  if (SCRIPT_TAG_PATTERN.test(original)) {
    issues.add("script-tag");
  }

  if (EVENT_HANDLER_PATTERN.test(original)) {
    issues.add("event-handler");
  }

  if (
    JAVASCRIPT_URL_PATTERN.test(original) ||
    DATA_HTML_PATTERN.test(original)
  ) {
    issues.add("unsafe-url");
  }

  if (
    /<(iframe|object|embed|form|input|button|textarea|select|option|meta|link|base)\b/gi.test(
      original,
    )
  ) {
    issues.add("forbidden-tag");
  }

  if (sanitized !== original) {
    issues.add("content-modified-by-sanitizer");
  }

  if (
    issues.has("script-tag") ||
    issues.has("event-handler") ||
    issues.has("unsafe-url") ||
    issues.has("forbidden-tag")
  ) {
    issues.add("unsafe-html");
  }

  return Array.from(issues);
}

export function useNotificationContentGuard(
  content: string,
): NotificationContentGuardResult {

  return useMemo(() => {

    const detectedType: DetectedContentType = detectContentType(content);

    let sanitizedContent: string;

    switch (detectedType) {
      case "text/html":
        sanitizedContent = sanitizeHtml(content);
        break;

      case "text/markdown":
      case "text/plain":
      default:
        sanitizedContent = sanitizePlain(content);
        break;
    }

    const issues: NotificationContentIssue[] =
      collectIssues(content, sanitizedContent);

    const isSafe: boolean =
      !issues.includes("script-tag") &&
      !issues.includes("event-handler") &&
      !issues.includes("unsafe-url") &&
      !issues.includes("forbidden-tag");

    return {
      detectedType,
      originalContent: content,
      sanitizedContent,
      isSafe,
      issues,
    };

  }, [content]);
}