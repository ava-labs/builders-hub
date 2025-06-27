'use client'

import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { ArrowRight, CalendarDays, Award, Users } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { HeroBackground } from '@/components/landing/hero'

interface EventCardProps {
  title: string
  description: string
  icon: React.ReactNode
  image: any
  url: string
  color: 'red' | 'blue' | 'green' | 'pink' | 'grey' | 'purple' | 'orange'
  arrowColor: 'white' | 'black'
}

function EventCard({ title, description, icon, image, url, color, arrowColor }: EventCardProps) {
  const gradients: Record<EventCardProps['color'], string> = {
    red: "from-red-500 to-red-500",
    blue: "from-blue-500 to-cyan-500",
    green: "from-green-500 to-emerald-500",
    pink: "from-pink-500 to-pink-500",
    grey: "from-gray-500 to-gray-500",
    purple: "from-purple-500 to-purple-500",
    orange: "from-orange-500 to-orange-500",
  }

  return (
    <div className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-sm h-[400px]">
      <div className="relative p-6 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow duration-200 h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradients[color]} flex items-center justify-center text-white flex-shrink-0`}>
            {icon}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        <div className="w-full h-48 relative rounded-lg overflow-hidden mb-4 flex-shrink-0">
          <Image 
            src={image}
            alt={title}
            fill
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-xl font-semibold mb-2 flex-shrink-0">{title}</h3>
          <p className="text-muted-foreground text-sm flex-1 overflow-hidden">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const { resolvedTheme } = useTheme()
  const arrowColor = resolvedTheme === "dark" ? "white" : "black"

  return (
    <>
      <HeroBackground />
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-12">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-black.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Avalanche Events
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join the Avalanche community at our global events, hackathons, and meetups to connect, learn, and build the future of blockchain technology.
          </p>
        </section>

        {/* Events Grid */}
        <section id="events" className="space-y-12 mt-16">
          <div className="grid md:grid-cols-3 gap-6">
            <a href="/hackathons" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Hackathons"
                description="Hackathons aim to harness the potential of Avalanche´s robust technology stack to address pressing issues and create scalable, practical solutions."
                icon={<Award className="w-8 h-8" color="white" />}
                image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/hackathons-banner-nyqtkzooc3tJ4qcLjfLJijXz6uJ6oH.png"
                url="/hackathons"
                color="blue"
                arrowColor={arrowColor}
              />
            </a>
            <a href="https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Avalanche Calendar"
                description="Explore upcoming Avalanche events, meetups, and community gatherings. Stay connected with the latest happenings in the ecosystem."
                icon={<CalendarDays className="w-8 h-8" color="white" />}
                image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/Avalanche-Event-TnQovuFzkt8CGHyF0wfiSYTrGVtuPU.jpg"
                url="https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4"
                color="purple"
                arrowColor={arrowColor}
              />
            </a>
            <a href="https://lu.ma/Team1?utm_source=builder_hub" target="_blank" rel="noopener noreferrer" className="block hover:no-underline">
              <EventCard
                title="Community driven events"
                description="Check out and join the global meetups, workshops and events organized by Avalanche Team1"
                icon={<Users className="w-6 h-6" color="white" />}
                image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/local_events_team1-UJLssyvek3G880Q013A94SdMKxiLRq.jpg"
                url="https://lu.ma/Team1?utm_source=builder_hub"
                color="green"
                arrowColor={arrowColor}
              />
            </a>
          </div>
        </section>
      </main>
    </>
  )
}