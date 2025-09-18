import { getInstructorsByNames } from '@/content/common/intro/instructors'
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

export default function Instructors({ names }: { names: string[] }) {
    return (
        <div className="flex flex-col space-y-4">
            {getInstructorsByNames(names).map((instructor) => (
                <Link href={instructor.x} target="_blank" key={uuidv4()} className="flex text-muted-foreground hover:text-foreground">
                    <div className="relative w-12 h-12">
                        <Image
                            src={`/common-images/intro/instructors/${instructor.name.toLowerCase().replaceAll(" ", "-")}.jpeg`}
                            alt={instructor.name}
                            fill
                            className="rounded-full object-cover"
                        />
                    </div>
                    <div className="flex flex-col ml-3 my-auto">
                        <div className="font-semibold">
                            {instructor.name}
                        </div>
                        <div className="text-xs">
                            {instructor.title}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}