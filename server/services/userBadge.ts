import { prisma } from "@/prisma/prisma";

// export async function validateBadgePerUserPerCourse(
//   courseId: string,
//   user_id: string
// ) {
//   const userBadge = await prisma.userBadge.findFirst({
//     where: {
//       user_id: user_id,
//       badge: {
//         metadata: {
//           path: ["course_id"],
//           equals: courseId,
//         },
//       },
//     },
//   });

//   if(!userBadge){
    
//   }
// }
