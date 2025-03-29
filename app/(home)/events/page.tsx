'use client'

import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { ArrowRight, CalendarDays, Award, Users } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import SummitLondonBanner from '@/public/nav-banner/avalanche_summit_london.png';
import HackathonLondonBanner from '@/public/nav-banner/hackathon_luma.png';
import HackathonBBABanner from '@/public/nav-banner/hackathon_bba.png';
import Team1Banner from '@/public/nav-banner/local_events_team1.jpg';

interface EventCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  image: any;
  url: string;
  color: 'red' | 'blue' | 'green' | 'pink' | 'grey' | 'purple' | 'orange';
  arrowColor: 'white' | 'black';
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
    <div className="group relative overflow-hidden rounded-3xl transition-all duration-300 hover:shadow-2xl">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradients[color]} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
      <div className="relative p-6 space-y-4 bg-card border border-border rounded-3xl transition-all duration-300 group-hover:bg-card/50 group-hover:backdrop-blur-sm">
        <div className="flex justify-between items-start">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center text-white`}>
            {icon}
          </div>
          <Button variant="ghost" className="group/button">
            <ArrowRight color={arrowColor} className="ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1" />
          </Button>
        </div>
        <div className="w-full h-48 relative rounded-xl overflow-hidden mb-4">
          <Image 
            src={image}
            alt={title}
            fill
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default function Page() {
  const { resolvedTheme } = useTheme()
  const arrowColor = resolvedTheme === "dark" ? "white" : "black"

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-24">
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
          <h1 className="text-4xl md:text-7xl font-bold tracking-tighter">
            Avalanche Events
            <span className="block pb-1 text-[#EB4C50]">
              Connect & Build Together
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Join the Avalanche community at our global events, hackathons, and meetups to connect, learn, and build the future of blockchain technology.
          </p>
          <Link href="#events">
            <Button className="mt-6 rounded-full text-lg px-8 py-6 bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-lg hover:shadow-xl text-white dark:text-white">
              Find Events <ArrowRight color="white" className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        {/* Featured Event Section */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 dark:from-yellow-500/10 dark:to-amber-500/10 rounded-3xl" />
          <div className="relative px-6 py-12 md:py-20 text-center space-y-6 rounded-3xl border border-yellow-500/30 backdrop-blur-sm shadow-2xl transform transition-all duration-300">
            <div className="flex justify-center">
              <div className="inline-flex items-center rounded-full border border-yellow-500/50 px-4 py-1.5 text-sm font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-500/10">
                🗓️ Featured Event
              </div>
            </div>
            <h2 className="text-4xl md:text-7xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
              Avalanche Summit London
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join us for the largest Avalanche event of the year, bringing together developers, investors, and innovators from around the world.
            </p>
            <Link href="https://www.avalanchesummitlondon.com/" target="_blank" rel="noopener noreferrer">
              <Button className="mt-6 rounded-full text-lg px-8 py-6 bg-amber-500 hover:bg-amber-600 transition-all duration-300 shadow-lg hover:shadow-xl text-white dark:text-white">
                Register Now <ArrowRight color="white" className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Events Grid */}
        <section id="events" className="space-y-12">
          <h2 className="text-3xl md:text-5xl font-bold text-center">Upcoming Events</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <a href="https://www.avalanchesummitlondon.com/" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Avalanche Summit London"
                description="Join us for Avalanche Summit, London, as we explore the world's original global financial hub through the lens of Web3."
                icon={<CalendarDays className="w-8 h-8" color='white'/>}
                image={SummitLondonBanner}
                url="https://www.avalanchesummitlondon.com/"
                color="red"
                arrowColor={arrowColor}
              />
            </a>
            <a href="/hackathon" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Summit Hackathon London"
                description="This hackathon aims to harness the potential of Avalanche's robust technology stack to address pressing issues and create scalable, practical solutions."
                icon={<Award className="w-8 h-8" color='white'/>}
                image={HackathonLondonBanner}
                url="/hackathon"
                color="blue"
                arrowColor={arrowColor}
              />
            </a>
            <a href="/hackathons/1661940a-d9f4-4811-9d1a-e6e8d4585893" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Beantown Showndown Hackathon"
                description="Boston Blockchain Association + Avalanche Hackathon"
                icon={<Award className="w-8 h-8" color='white'/>}
                image={HackathonBBABanner}
                url="/hackathon"
                color="blue"
                arrowColor={arrowColor}
              />
            </a>
            <a href="https://lu.ma/Team1?utm_source=builder_hub" target="_blank" rel="noopener noreferrer">
              <EventCard
                title="Team1 Events"
                description="Check out and join the global meetups, workshops and events organized by Avalanche Team1"
                icon={<Users className="w-8 h-8" color='white'/>}
                image={Team1Banner}
                url="https://lu.ma/Team1?utm_source=builder_hub"
                color="green"
                arrowColor={arrowColor}
              />
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}