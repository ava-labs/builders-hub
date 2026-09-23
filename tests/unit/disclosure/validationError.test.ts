import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/server/services/projects';
import { ValidationError as HackathonValidationError } from '@/server/services/hackathons';

describe('ValidationError', () => {
  // Finding: routes doing `NextResponse.json({ error: wrappedError })` shipped
  // the whole details array, enumerating internal schema field names.
  it('serialises to an empty object instead of a field map', () => {
    const err = new ValidationError('Project validation failed', [
      { field: 'project_name', message: 'required' } as any,
      { field: 'hackaton_id', message: 'required' } as any,
    ]);

    const body = JSON.stringify({ error: err });
    expect(body).toBe('{"error":{}}');
    expect(body).not.toMatch(/project_name|hackaton_id|details/);
  });

  it('still exposes details and cause to server-side code', () => {
    const err = new ValidationError('nope', [{ field: 'bio', message: 'too long' } as any]);
    expect(err.cause).toBe('ValidationError');
    expect(err.details).toHaveLength(1);
    expect(err.details[0].field).toBe('bio');
    expect(err.message).toBe('nope');
  });

  it('keeps working with the status-selection check routes rely on', () => {
    const err = new ValidationError('nope', []);
    const status = err.cause == 'ValidationError' ? 400 : 500;
    expect(status).toBe(400);
  });

  it('survives a spread without re-exposing details', () => {
    const err = new ValidationError('nope', [{ field: 'x', message: 'y' } as any]);
    expect(JSON.stringify({ ...err })).toBe('{}');
  });

  // There are two distinct classes with this name; both reach routes that
  // serialise the error object, so both must be covered.
  it('covers the hackathons ValidationError too', () => {
    const err = new HackathonValidationError('Validation failed', [
      { field: 'content.stages', message: 'bad' } as any,
    ]);
    expect(JSON.stringify({ error: err })).toBe('{"error":{}}');
    expect(err.cause).toBe('ValidationError');
    expect(err.details).toHaveLength(1);
  });
});
