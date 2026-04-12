import { prisma } from "@/prisma/prisma";

export interface FormDataInput {
  formData: Record<string, any>;
  projectId: string;
  origin: string;
}

export async function createFormData(input: FormDataInput) {
  const { formData, projectId, origin } = input;
  
  // Remove projectId and userId from formData before storing
  const { projectId: _, userId: __, ...cleanFormData } = formData;
  
  const formDataRecord = await prisma.formData.create({
    data: {
      form_data: cleanFormData as any,
      project_id: projectId,
      origin: origin,
      timestamp: new Date(),
    },
  });
  
  return formDataRecord;
}
