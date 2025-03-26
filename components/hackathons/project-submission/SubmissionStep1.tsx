"use client";

import React, { FC } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import { Search } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmissionForm } from "./General";
import { MultiSelectTrack } from "./MultiSelectTrack";

interface TeamMember {
  name: string;
  email: string;
  role: string;
  status: string;
}

const SubmitStep1: FC = () => {
  const form = useFormContext<SubmissionForm>();

  // Ejemplo de miembros de equipo
  const teamMembers: TeamMember[] = [
    {
      name: "Ken",
      email: "ken025@yahoo.com",
      role: "Developer",
      status: "Confirmed",
    },
    {
      name: "Alex",
      email: "alex12@gmail.com",
      role: "Designer",
      status: "Confirmed",
    },
    {
      name: "Monserrat",
      email: "monserrat44@gmail.com",
      role: "PM",
      status: "Confirmed",
    },
    {
      name: "Silas",
      email: "silas87@gmail.com",
      role: "Researcher",
      status: "Awaiting Confirmation",
    },
  ];

  return (
    <div className="flex flex-col w-full text-white mt-6 space-y-8">
      {/* SECCIÓN GENERAL */}
      <section className="space-y-4">
        <h3 className="font-medium text-white text-lg md:text-xl">
          General Section
        </h3>
        <p className="text-sm text-muted-foreground">
          Provide key details about your project that will appear in listings.
        </p>

        {/* Project Name */}
        <FormField
          control={form.control}
          name="projectName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your project name"
                  className="bg-[#2c2c2c] text-white w-full"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Short Description */}
        <FormField
          control={form.control}
          name="shortDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write a short and engaging overview..."
                  className="bg-[#2c2c2c] text-white w-full"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Full Description */}
        <FormField
          control={form.control}
          name="fullDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your project in detail..."
                  className="bg-[#2c2c2c] text-white h-24 w-full"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Track (MultiSelect) */}
        <FormField
          control={form.control}
          name="track"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Track</FormLabel>
              <FormControl>
                <MultiSelectTrack
                  value={field.value || []}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      {/* TEAM & COLLABORATION */}
      <section className="space-y-4">
        <h3 className="font-medium text-white text-lg md:text-xl">
          Team &amp; Collaboration
        </h3>
        {/* Campo de búsqueda */}
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <Input
            placeholder="Search team member by email or name"
            className="bg-[#2c2c2c] text-white w-full pl-10"
          />
        </div>

        {/* Botón de invitación */}
        <div className="flex justify-end">
          <Button variant="outline" type="button">
            Invite Team Member
          </Button>
        </div>

        {/* Tabla con scroll horizontal en pantallas pequeñas */}
        <div className="overflow-x-auto">
          <Table className="border border-[#333] w-full min-w-[500px]">
            <TableHeader>
              <TableRow className="bg-[#2c2c2c]">
                <TableHead className="text-white">Name</TableHead>
                <TableHead className="text-white">Email</TableHead>
                <TableHead className="text-white">Role</TableHead>
                <TableHead className="text-white">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member, index) => (
                <TableRow key={index} className="hover:bg-[#2c2c2c]">
                  <TableCell className="text-white">{member.name}</TableCell>
                  <TableCell className="text-white">{member.email}</TableCell>
                  <TableCell className="text-white">{member.role}</TableCell>
                  <TableCell className="text-white">{member.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};

export default SubmitStep1;
