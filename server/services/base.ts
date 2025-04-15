

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