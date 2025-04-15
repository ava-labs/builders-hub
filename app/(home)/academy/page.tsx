import COURSES from '@/content/courses';
import Link from 'next/link';

export default function HomePage(): React.ReactElement {
  return (
    <>
      <main className="container relative">
        <Hero />
        <Courses
          title="Explore our Courses"
          description="We offer fundamental courses specifically designed for individuals who are new to the Avalanche ecosystem, and advanced courses for those who wish to master the art of configuring, modifying, or even creating entirely new Virtual Machines from scratch."
          courses={COURSES.official_featured}
        />

        {COURSES.ecosystem.length > 0 && (
          <Courses
            title="Ecosystem Courses"
            description="Check out the courses provided by our ecosystem partners."
            courses={COURSES.ecosystem}
          />
        )}
      </main>
    </>
  );
}

function Hero(): React.ReactElement {
  return <></>;
}

function Courses(props: { title: string; description: string; courses: any[] }): React.ReactElement {
  return (
    <div className="py-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto w-full lg:mx-0">
          <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center">
            {props.title}
          </h2>
          <p className="mt-12 text-center text-lg leading-8 text-muted-foreground">
            {props.description}
          </p>
        </div>
        <div className="flex justify-center items-center mt-8 gap-4">
          <Link
            href="/academy/blockchain-fundamentals"
            className="block max-w-xl flex-1 p-4 text-sm rounded-lg bg-muted border border-b"
            role="alert"
          >
            <span className="font-medium">Are you new to Blockchain?</span> Start with our Blockchain Fundamentals course{' '}
            <span className="underline">here</span>.
          </Link>
        </div>
        <div className="mx-auto mt-2 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-gray-200 pt-7 sm:mt-12 sm:pt-0 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {props.courses.map((course) => (
            <Link
              href={`/academy/${course.slug}`}
              key={course.slug}
              className="flex max-w-xl flex-col items-start space-y-2"
            >
              <img
                src={`/course-banner/${course.slug}.jpg`}
                alt=""
                className="w-full aspect-3/2 object-cover rounded-lg mb-5"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-gray-500">{course.duration}</span>
                {[...course.tools, ...course.languages].map((item) => (
                  <span
                    key={item}
                    className="relative z-10 rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="group">
                <h3 className="mt-3 text-lg font-semibold leading-6 group-hover:text-gray-600">
                  <span>{course.name}</span>
                </h3>
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {course.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}