import { prisma } from "@/prisma/prisma";

export async function getRegisterFormByUserId(userId:string){

    const registerForm = await prisma.registerForm.findFirst({})
}