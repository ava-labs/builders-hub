'use client'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { ArrowRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useState } from 'react'

export default function ContactPage() {
  const { resolvedTheme } = useTheme()
  const arrowColor = resolvedTheme === "dark" ? "white" : "black"
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const handleIframeLoad = () => {
    setIframeLoaded(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-16">
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
            Avalanche
            <span className="block pb-1 text-[#EB4C50]">
              For Students
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover opportunities for students to explore blockchain technology, access educational resources, and join our community of builders on Avalanche.
          </p>
        </section>

        <section className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="bg-[#f4f8fa] dark:bg-gray-900 rounded-3xl overflow-hidden shadow-lg">
              {!iframeLoaded && (
                <div className="flex items-center justify-center h-96">
                  <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            
              <div 
                className={`transition-opacity duration-300 ${iframeLoaded ? 'opacity-100' : 'opacity-0'} w-full`}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#EB4C50 #f1f1f1'
                }}
              >
                <iframe 
                  src="https://share.hsforms.com/10iRrhSW3Q9Od8rcOda5O2A4h8ew" 
                  width="100%" 
                  height="800px" 
                  style={{ 
                    border: "none",
                    backgroundColor: "transparent",
                    margin: "-20px 0",
                    width: "100%",
                    overflow: "auto"
                  }} 
                  title="Contact Form"
                  onLoad={handleIframeLoad}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="relative max-w-6xl mx-auto">
          <div className="absolute inset-0 bg-linear-to-r from-yellow-500/20 to-amber-500/20 dark:from-yellow-500/10 dark:to-amber-500/10 rounded-3xl" />
          <div className="relative px-6 py-12 text-center space-y-6 rounded-3xl border border-yellow-500/30 backdrop-blur-xs shadow-2xl">
            <h2 className="text-3xl font-bold">Learn With Academy</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Kickstart your Avalanche development journey with Academy courses. Learn to build dApps, smart contracts, and more with expert-led tutorials designed specifically for students.
            </p>
            <Link href="/academy">
              <Button className="rounded-full px-8 py-6 bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-lg hover:shadow-xl text-white">
                Explore Avalanche Academy<ArrowRight color="white" className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}