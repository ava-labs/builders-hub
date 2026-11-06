import { DocsCallout } from '@/components/docs-book/callout';
import { formatDeprecationDate, type ApiDeprecation } from '@/lib/api-deprecations';

export function ApiDeprecationNotice({ deprecation }: { deprecation: ApiDeprecation }) {
  const { name, deprecatedAt, sunsetAt, decommissionedAt } = deprecation;
  return (
    <DocsCallout type="warn" title="Deprecated" art={false}>
      <p>
        The {name} is deprecated and will be sunset on {formatDeprecationDate(sunsetAt)}. Plan to migrate off it
        before then.
      </p>
      <ul>
        <li>
          <strong>Deprecated:</strong> {formatDeprecationDate(deprecatedAt)}
        </li>
        <li>
          <strong>Sunset:</strong> {formatDeprecationDate(sunsetAt)}
        </li>
        <li>
          <strong>Decommissioned:</strong> {formatDeprecationDate(decommissionedAt)}
        </li>
      </ul>
    </DocsCallout>
  );
}
