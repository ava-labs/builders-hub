'use client';
import { Custom } from 'fumadocs-openapi/playground/client';
import { useState } from 'react';

export function BodyFieldWithExpandedParams({ 
  fieldName, 
  info 
}: { 
  fieldName: 'body'; 
  info: { schema: any; mediaType: string } 
}) {
  const { field } = Custom.useController({ name: fieldName });
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set(['params']));
  
  const toggleField = (key: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const renderSchema = (schema: any, path: string = '', level: number = 0): React.ReactNode => {
    if (!schema || typeof schema !== 'object') return null;

    const properties = schema.properties || {};
    const required = schema.required || [];

    return Object.entries(properties).map(([key, propSchema]: [string, any]) => {
      const fieldPath = path ? `${path}.${key}` : key;
      const isRequired = required.includes(key);
      const isObject = propSchema.type === 'object';
      const isExpanded = expandedFields.has(key);

      return (
        <fieldset key={fieldPath} className={`flex flex-col gap-1.5 ${isObject && isExpanded ? 'col-span-full @container' : ''}`}>
          <label htmlFor={`body.${fieldPath}`} className="w-full inline-flex items-center gap-0.5">
            {isObject && (
              <button
                type="button"
                onClick={() => toggleField(key)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground p-1 [&_svg]:size-4 text-fd-muted-foreground -ms-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </button>
            )}
            <span className="text-xs font-medium text-fd-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-mono me-auto">
              {key}
              {isRequired && <span className="text-red-400/80 mx-1">*</span>}
            </span>
            <code className="text-xs text-fd-muted-foreground">{propSchema.type || 'any'}</code>
          </label>
          
          {!isObject && (
            <div className="flex flex-row gap-2">
              <input
                className="flex h-9 w-full rounded-md border bg-fd-secondary px-2 py-1.5 text-[13px] text-fd-secondary-foreground transition-colors placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring disabled:cursor-not-allowed disabled:opacity-50"
                id={`body.${fieldPath}`}
                placeholder={propSchema.default || "Enter value"}
                type={propSchema.type === 'integer' || propSchema.type === 'number' ? 'number' : 'text'}
                value={(() => {
                  const pathParts = fieldPath.split('.');
                  let value = field.value;
                  for (const part of pathParts) {
                    if (value && typeof value === 'object' && part in value) {
                      value = (value as Record<string, any>)[part];
                    } else {
                      return propSchema.default || '';
                    }
                  }
                  return value || '';
                })()}
                onChange={(e) => {
                  const newValue = propSchema.type === 'integer' || propSchema.type === 'number'
                    ? Number(e.target.value)
                    : e.target.value;
                  const currentValue = (field.value && typeof field.value === 'object') ? field.value as Record<string, any> : {};

                  // Handle nested path
                  const pathParts = fieldPath.split('.');
                  const updated = { ...currentValue };
                  let current: any = updated;

                  for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (!(part in current) || typeof current[part] !== 'object') {
                      current[part] = {};
                    } else {
                      current[part] = { ...current[part] };
                    }
                    current = current[part];
                  }

                  current[pathParts[pathParts.length - 1]] = newValue;
                  field.onChange(updated);
                }}
                name={`body.${fieldPath}`}
                {...(propSchema.type === 'number' || propSchema.type === 'integer' ? { step: propSchema.type === 'integer' ? '1' : 'any' } : {})}
              />
            </div>
          )}
          
          {isObject && isExpanded && (
            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 rounded-lg border border-fd-primary/20 bg-fd-background/50 p-2 shadow-sm ml-4">
              {renderSchema(propSchema, fieldPath, level + 1)}
            </div>
          )}
        </fieldset>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 rounded-lg border border-fd-primary/20 bg-fd-background/50 p-2 shadow-sm">
      {renderSchema(info.schema)}
    </div>
  );
}

