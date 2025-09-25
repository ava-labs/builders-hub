import React from 'react';

/**
 * Safely parses text that may contain HTML links and returns React elements
 * This avoids using dangerouslySetInnerHTML while still supporting links
 */
export function parseTextWithLinks(text: string, className?: string): React.ReactElement {
  // Regular expression to match anchor tags
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  
  // Split the text and create elements
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add the link
    const [fullMatch, href, linkText] = match;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-red-600 hover:text-red-700 underline"
      >
        {linkText}
      </a>
    );
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  // If no links were found, just return the plain text
  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }
  
  return <span className={className}>{parts}</span>;
}
