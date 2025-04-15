"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Check, X } from "lucide-react"
import Link from "next/link"
import posthog from 'posthog-js'

export function PrivacyPolicyBox() {
  const [mounted, setMounted] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    setShouldShow(!consent)
    setMounted(true)
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'yes')
    posthog.set_config({ persistence: 'localStorage+cookie' })
    setShouldShow(false)
    window.location.reload()
  }

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'no')
    posthog.set_config({ persistence: 'memory' })
    setShouldShow(false)
    window.location.reload()
  }

  if (!mounted) return null
  if (!shouldShow) return null

  return (
    <div className="fixed bottom-4 left-0 sm:left-4 isolate z-99999 w-full sm:w-auto px-2 sm:px-0">
      <Card className="relative w-full max-w-md border shadow-lg bg-white dark:bg-slate-950 rounded-lg">
        <CardHeader className="pb-2 bg-white dark:bg-slate-950 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-medium">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white dark:bg-slate-950 py-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            We respect your privacy and are committed to protecting your personal data. This privacy policy will inform
            you about how we look after your personal data and tell you about your privacy rights.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-2 bg-white dark:bg-slate-950 rounded-b-lg">
          <div className="flex justify-between w-full gap-2">
            <Button variant="default" className="flex-1" onClick={handleAccept}>
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Accept
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDecline}>
              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Decline
            </Button>
          </div>
          <Button variant="outline" asChild className="w-full text-xs sm:text-sm">
            <Link href="https://www.avax.network/privacy-policy">Read full policy</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
