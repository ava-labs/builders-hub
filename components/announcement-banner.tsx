"use client"

import { Banner } from "fumadocs-ui/components/banner"
import Link from "next/link"
import { useState } from "react"

export function AnnouncementBanner() {
  const [showBanner, setShowBanner] = useState(true)

  if (!showBanner) return null

  return (
    <div className="relative z-30">
      <Banner changeLayout={false} className="bg-gray-100 dark:bg-gray-900 text-sm">
        <div className="flex items-center space-x-3 text-black dark:text-white">
          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">NEW</span>
          <p className="flex-grow">
            Applications for{" "}
            <Link
              href="https://lu.ma/avalanchesummitlondonhackathon?utm_source=builder_hub"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-red-600 transition-colors"
            >
              London Hackathon
            </Link>{" "}
            are now open!
          </p>
          <button
            onClick={() => setShowBanner(false)}
            aria-label="Close banner"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-3 text-base"
          >
            ✕
          </button>
        </div>
      </Banner>
      <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:[background:radial-gradient(#1f2937_1px,transparent_1px)]" />
    </div>
  )
}

