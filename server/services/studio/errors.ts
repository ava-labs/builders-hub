/** An error whose message is safe to show the builder, with the HTTP status a route should answer with. */
export class StudioError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StudioError";
  }
}

export const projectNotFound = () => new StudioError(404, "Project not found", "not_found");
