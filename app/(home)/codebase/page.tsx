'use client'

import Image from 'next/image';
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-24">
        <section className="text-center space-y-6 pt-12">
          <div className="flex justify-center mb-6">
            <Image
              src="/codebase-black.svg"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="dark:hidden"
            />
            <Image
              src="/codebase-white.svg"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tighter">
            Grow Faster
            <span className="block pb-1 text-[#EB4C50]">
              With Codebase
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Your Launchpad for testing ideas, building products and scaling your Web3 Startup.
          </p>
        </section>

        <section className="relative max-w-[1100px] mx-auto px-4">
          <div className="absolute inset-0 rounded-3xl" style={{background: "linear-gradient(90deg, rgba(255, 0, 217, 0.1) 0%, rgba(0, 74, 153, 0.1) 100%)"}}/>
          <div 
            className="relative px-6 py-12 md:py-20 text-center space-y-6 rounded-3xl"
            style={{
              border: "1px solid transparent",
              backgroundImage: "background: linear-gradient(90deg, rgba(255, 0, 217, 0.1) 0%, rgba(0, 74, 153, 0.1) 100%)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
            }}
          >
            <div className="flex justify-center">
              <div className="inline-flex items-center rounded-full border border-purple-400/50 px-4 py-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10">
                Codebase Incubator
              </div>
            </div>
            
            <h2 className="text-2xl md:text-5xl font-semibold text-transparent" style={{backgroundImage: "linear-gradient(90deg, #FF00D9 0%, #004A99 100%)", backgroundClip: "text", WebkitBackgroundClip: "text"}}>
              Season 4 Applications Are Closed!
            </h2>  
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Applications closed on June 6, 2025. Stay tuned for updates on the next season!
            </p>
            <div className="flex flex-col justify-center sm:flex-row gap-4 w-full">
              <Link href="https://codebase.avax.network">
                <Button className="rounded-full border border-purple-400/50 px-4 py-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10">
                  Learn More
                </Button>
              </Link>  
              
              <Button disabled className="rounded-full text-sm px-4 py-1.5 text-white shadow-lg hover:shadow-xl transition-all duration-300" style={{background: "linear-gradient(90deg, rgb(255 110 243) 0%, rgb(128 174 201) 100%)"}}>
                Applications Closed
              </Button>
            
            </div>
          </div>
        </section>

        <section className="relative max-w-[1100px] mx-auto px-4">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 mb-20">
            <div className="space-y-4">
              <h2 className="text-7xl font-bold">Create</h2>
              <p className="text-md max-w-sm">
                Turn your ideas into reality on a platform build for builders. Launch custom blockchains, design powerful apps
                and bring your vision to life—without compromise. Innovation starts here.
              </p>
            </div>

            <div className="rounded-2xl p-6 border border-zinc-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-200 p-3 rounded-xl">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7 8L3 12L7 16M17 8L21 12L17 16"
                      stroke="#6366F1"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold">Hackathons</h3>
              </div>

              <p className="text-zinc-400 mb-6">
                Our hackathons aim to harness the potential of Avalanche's robust technology stack to address pressing issues
                and create scalable, practical solutions
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="/hackathons" className="flex items-center gap-2 underline font-medium">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 mb-20">
            <div className="space-y-4">
              <h2 className="text-7xl font-bold">Build</h2>
              <p className="text-md max-w-sm">
                You bring the vision—we'll help you build it. From dev tools to technical support, we're here to guide every
                step of the journey.
              </p>
            </div>

            <div className="rounded-2xl p-6 border border-zinc-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-200 p-3 rounded-xl">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7 8L3 12L7 16M17 8L21 12L17 16"
                      stroke="#6366F1"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold">Codebase Incubator</h3>
              </div>

              <p className="text-zinc-400 mb-6">
                The official Avalanche incubator that funds and supports web3 founders as they shape the future with
                category-defining projects
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="https://codebase.avax.network" className="flex items-center gap-2 underline font-medium">
                  Learn More
                </Link>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-7xl font-bold">Grow</h2>
              <p className="text-md max-w-sm">
                From mainnet to momentum, we help you grow. Tap into performance, community, and ecosystem support designed
                to amplify your project's reach.
              </p>
            </div>

            <div className="rounded-2xl p-6 border border-zinc-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-200 p-3 rounded-xl">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7 16L3 12M3 12L7 8M3 12H16M16 8L20 12L16 16"
                      stroke="#6366F1"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold">Innovation House</h3>
              </div>

              <p className="text-zinc-400 mb-6">
                Transforming the Web 2.0 "Hacker Home" into a Web3 powerhouse, Innovation House connects global talent to
                collaborate and shape the future of blockchain on Avalanche.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="https://innovationhouse.avax.network" className="flex items-center gap-2 underline font-medium">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="relative max-w-[1100px] mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-5xl mb-4">Codebase has impact</h2>
            <p className="text-zinc-400 text-md mb-16 max-w-lg">
              Real products, real scale, real-world impact—see what our developers have achieved.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">10 Weeks to Testnet</h3>
                <p className="text-zinc-400 text-md">
                  From idea to live deployment in just 10 weeks—Codebase is built for momentum.
                </p>
              </div>
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">70% Launch Rate</h3>
                <p className="text-zinc-400 text-md">
                  Most teams ship MVPs or raise funding within 3 months of completing the program.*
                </p>
              </div>
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">$50K Non-Dilutive Capital</h3>
                <p className="text-zinc-400 text-md">
                  Each selected team receives a $50,000 stipend—no equity, no strings.
                </p>
              </div>
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">50+ Mentor Sessions</h3>
                <p className="text-zinc-400 text-md">
                  Work directly with top founders, engineers, and investors from the Avalanche ecosystem and beyond.
                </p>
              </div>
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">25+ Funded Startups</h3>
                <p className="text-zinc-400 text-md">
                  Codebase alumni are building core infra, high-growth apps, and scaling across Web3.
                </p>
              </div>
              <div className="p-6 lg:p-10 border border-zinc-300">
                <h3 className="text-xl md:text-3xl text-blue-700 mb-4">$2.9M Awarded in Grants</h3>
                <p className="text-zinc-400 text-md">
                  Projects competing in Hackathons and Codebase incubator received $2.9M in grants in 2024 alone.
                </p>
              </div>
            </div>

            <p className="text-zinc-400 text-sm mt-4">*Based on past cohort outcomes and internal tracking.</p>
          </div>
        </section>

        <section className="relative max-w-[1100px] mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-5xl mb-16">What Sets Codebase Apart</h2>

            <div className="grid md:grid-cols-2 gap-x-12 gap-y-16">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Narrative Coaching (Founder Favorite):</h3>
                <p className="text-zinc-400 text-md leading-relaxed">
                  We treat storytelling like product work. Through hands-on pitch sessions and expert feedback, we help you
                  craft a compelling narrative that drives conviction and opens doors.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">Structured Momentum, Zero Dilution:</h3>
                <p className="text-zinc-400 text-md leading-relaxed">
                  From hackathons to Innovation House, every Codebase program is fast, focused, and founder-friendly—with
                  $50K in non-dilutive funding for incubator teams.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">Execution-First, Web3-Native:</h3>
                <p className="text-zinc-400 text-md leading-relaxed">
                  Every touchpoint is built for builders in Web3. Get practical help on token design, validator strategy,
                  UX, and more from Ava Labs engineers and expert mentors.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">A Cohort of Real Builders:</h3>
                <p className="text-zinc-400 text-md leading-relaxed">
                  We keep it small so the support goes deep. You'll build alongside peers who are serious, scrappy, and
                  solving real problems—not chasing hype.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative max-w-[1100px] mx-auto px-4 mb-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-5xl mb-4">
                Guidance from Builders <br className="hidden md:block" />
                Who've Done It:
            </h2>
            <p className="text-zinc-400 text-md mb-16 max-w-lg">
              Get real advice from people who've built real things. Our mentors are hands-on operators, not just
              advisors—they've scaled protocols, raised rounds, and shipped code. They're here to help you avoid mistakes,
              move faster, and think bigger.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="space-y-3">
                  <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-purple-100 to-blue-100">
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-0.5">Hansen Niu</h3>
                  <p className="text-md mb-0.25">Co-Founder</p>
                  <p className="text-md">BENQI</p>
                </div>
              </div>

              <div className="text-center">
                <div className="space-y-3">
                  <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-purple-100 to-blue-100">
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-0.5">Christina Beltramini</h3>
                  <p className="text-md mb-0.25">Head of Growth</p>
                  <p className="text-md">LENS + AAVE</p>
                </div>
              </div>

              <div className="text-center">
                <div className="space-y-3">
                  <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-purple-100 to-blue-100">
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-0.5">Steven Gates</h3>
                  <p className="text-md mb-0.25">Co-Founder</p>
                  <p className="text-md">GOGOPOOL</p>
                </div>
              </div>

              <div className="text-center">
                <div className="space-y-3">
                  <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-purple-100 to-blue-100">
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-0.5">Austin Barack</h3>
                  <p className="text-md mb-0.25">Founder & Managing Partner</p>
                  <p className="text-md">RELAYER CAPITAL</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
