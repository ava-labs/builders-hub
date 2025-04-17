
import { hasAtLeastOne, requiredField, validateEntity, Validation } from './base';
import { revalidatePath } from 'next/cache';
import { ValidationError } from './hackathons';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/prisma/prisma';
import { RegistrationForm } from '@/types/registrationForm';


export const registerValidations: Validation[] = [
    { 
      field: 'name', 
      message: 'Name is required.', 
      validation: (registerForm: RegistrationForm) => requiredField(registerForm, 'name') 
    },
    { 
      field: 'email', 
      message: 'A valid email is required.', 
      validation: (registerForm: RegistrationForm) => requiredField(registerForm, 'email') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email || '') 
    },
    { 
      field: 'city', 
      message: 'City is required.', 
      validation: (registerForm: RegistrationForm) => requiredField(registerForm, 'city') 
    },
    { 
      field: 'interests', 
      message: 'Please select at least one interest.', 
      validation: (registerForm: RegistrationForm) => hasAtLeastOne(registerForm, 'interests') 
    },
    { 
      field: 'web3_proficiency', 
      message: 'Web3 proficiency is required.', 
      validation: (registerForm: RegistrationForm) => requiredField(registerForm, 'web3_proficiency') 
    },
    { 
      field: 'tools', 
      message: 'Please select at least one tool.', 
      validation: (registerForm: RegistrationForm) => hasAtLeastOne(registerForm, 'tools') 
    },
    { 
      field: 'roles', 
      message: 'Please select at least one role.', 
      validation: (registerForm: RegistrationForm) => hasAtLeastOne(registerForm, 'roles') 
    },
    { 
      field: 'languages', 
      message: 'Please select at least one programming language.', 
      validation: (registerForm: RegistrationForm) => hasAtLeastOne(registerForm, 'languages') 
    },
    { 
      field: 'hackathon_participation', 
      message: 'Hackathon participation is required.', 
      validation: (registerForm: RegistrationForm) => requiredField(registerForm, 'hackathon_participation') 
    },
    { 
      field: 'terms_event_conditions', 
      message: 'You must accept the Event Terms and Conditions to continue.', 
      validation: (registerForm: RegistrationForm) => registerForm.terms_event_conditions === true 
    },
    { 
      field: 'newsletter_subscription', 
      message: 'You must agree to the newsletter subscription.', 
      validation: (registerForm: RegistrationForm) => registerForm.newsletter_subscription === true 
    },
    { 
      field: 'prohibited_items', 
      message: 'You must agree not to bring prohibited items to continue.', 
      validation: (registerForm: RegistrationForm) => registerForm.prohibited_items === true 
    },
  ];

export const validateRegisterForm = (registerData: Partial<RegistrationForm>): Validation[] => validateEntity(registerValidations, registerData);
export async function createRegisterForm(registerData: Partial<RegistrationForm>): Promise<RegistrationForm> {
    const errors = validateRegisterForm(registerData);
    console.error(errors)
    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors)
    }

    const content = { ...registerData } as Prisma.JsonObject

    console.log("content",content)
    const newRegisterFormData = await prisma.registerForm.upsert({
      where: {
          hackathon_id_email: {
              hackathon_id: registerData.hackathon_id as string,
              email: registerData.email as string,
          },
      },
      update: {
         
          city: registerData.city ?? "",
          company_name: registerData.company_name ?? null,
          dietary: registerData.dietary ?? null,
          hackathon_participation: registerData.hackathon_participation ?? "",
          interests: (registerData.interests ?? []).join(','),
          languages: (registerData.languages ?? []).join(','),
          roles: (registerData.roles ?? []).join(','),
          name: registerData.name ?? "",
          newsletter_subscription: registerData.newsletter_subscription ?? false,
          prohibited_items: registerData.prohibited_items ?? false,
          role: registerData.role ?? "",
          terms_event_conditions: registerData.terms_event_conditions ?? false,
          tools: (registerData.tools ?? []).join(','),
          web3_proficiency: registerData.web3_proficiency ?? "",
          github_portfolio: registerData.github_portfolio ?? "",
      },
      create: {
          hackathon: {
              connect: { id: registerData.hackathon_id },
          },
          user: {
              connect: { email: registerData.email },
          },
          utm: registerData.utm ?? "",
          city: registerData.city ?? "",
          company_name: registerData.company_name ?? null,
          dietary: registerData.dietary ?? null,
          hackathon_participation: registerData.hackathon_participation ?? "",
          interests: (registerData.interests ?? []).join(','),
          languages: (registerData.languages ?? []).join(','),
          roles: (registerData.roles ?? []).join(','),
          name: registerData.name ?? "",
          newsletter_subscription: registerData.newsletter_subscription ?? false,
          prohibited_items: registerData.prohibited_items ?? false,
          role: registerData.role ?? "",
          terms_event_conditions: registerData.terms_event_conditions ?? false,
          tools: (registerData.tools ?? []).join(','),
          web3_proficiency: registerData.web3_proficiency ?? "",
          github_portfolio: registerData.github_portfolio ?? "",
      },
  });
     registerData.id= newRegisterFormData.id;
    revalidatePath('/api/register-form/')
    return newRegisterFormData as unknown as RegistrationForm;
    
}


export async function getRegisterForm(email:string,hackathon_id:string) {

  const registeredData = await prisma.registerForm.findFirst({
    where: {
        user: {
            email: email,
        },
        hackathon_id: hackathon_id,
    },
});

return registeredData || null;
}