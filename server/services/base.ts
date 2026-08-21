

export const requiredField = (object: any, field: string) => object[field] !== undefined && object[field] !== null && object[field].trim() !== ""

export const hasAtLeastOne = (object: any, field: string) => Array.isArray(object[field]) && object[field].length > 0;

export const validateEntity = (validations: Validation[], entity: any): Validation[] => validations
    .filter((isValid) => !isValid.validation!(entity))
    .map((error: Validation) => {
        return { field: error.field, message: error.message };
    });


export interface Validation {
    field: string;
    message: string;
    validation?: Function;
}

/**
 * True for a plain object with at least one key. Used by the project services to
 * decide whether to persist a Json? column (website/socials) or leave it alone,
 * so an empty payload never overwrites stored links.
 */
export const isNonEmptyObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0;