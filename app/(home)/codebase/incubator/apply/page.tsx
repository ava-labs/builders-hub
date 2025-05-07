"use client"

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Page() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    github: "",
    projectIdea: "",
    experience: "",
    motivation: "",
    availability: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Codebase application submitted:", formData)
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <h1 className="text-5xl font-semibold mb-6">Apply to Codebase Incubator Season 4</h1>
        <p className="text-muted-foreground mb-12">
          Join our incubator program to turn your innovative ideas into reality. We provide mentorship, resources, and a
          supportive community.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="sr-only">
                First Name
              </Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                className="h-14"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="sr-only">
                Last Name
              </Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                className="h-14"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              className="h-14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github" className="sr-only">
              GitHub Profile
            </Label>
            <Input
              id="github"
              name="github"
              placeholder="GitHub Profile URL"
              value={formData.github}
              onChange={handleChange}
              className="h-14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectIdea" className="sr-only">
              Project Idea
            </Label>
            <Textarea
              id="projectIdea"
              name="projectIdea"
              placeholder="Describe your project idea"
              value={formData.projectIdea}
              onChange={handleChange}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience" className="sr-only">
              Relevant Experience
            </Label>
            <Textarea
              id="experience"
              name="experience"
              placeholder="Tell us about your relevant experience"
              value={formData.experience}
              onChange={handleChange}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivation" className="sr-only">
              Motivation
            </Label>
            <Textarea
              id="motivation"
              name="motivation"
              placeholder="Why do you want to join the incubator?"
              value={formData.motivation}
              onChange={handleChange}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability" className="sr-only">
              Availability
            </Label>
            <Input
              id="availability"
              name="availability"
              placeholder="Your availability for the program"
              value={formData.availability}
              onChange={handleChange}
              className="h-14"
            />
          </div>

          <Button type="submit" className="w-full h-14 mt-6">
            Submit Application
          </Button>
        </form>
      </div>
    </div>
  )
}