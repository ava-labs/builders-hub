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
import { FormLabelWithCheck } from "./FormLabelWithCheck";

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
    <div className="flex flex-col w-full  mt-6 space-y-8">
      {/* SECCIÓN GENERAL */}
      <section className="space-y-4">
        <h3 className="font-medium  text-lg md:text-xl">
          General Section
        </h3>
        <p className="text-sm text-muted-foreground">
          Provide key details about your project that will appear in listings.
        </p>

        {/* Project Name */}
        <FormField
          control={form.control}
          name="project_name"
          render={({ field }) => (
            <FormItem>
               <FormLabelWithCheck label="Project Name" checked={!!field.value} />
              <FormControl>
                <Input
                  placeholder="Enter your project name"
                  className="text-zinc-400 w-full dark:bg-zinc-950"
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
          name="short_description"
          render={({ field }) => (
            <FormItem>
           
              <FormLabelWithCheck label="Short Description" checked={!!field.value} />
              <FormControl>
                <Textarea
                  placeholder="Write a short and engaging overview..."
                  className="text-zinc-400 w-full dark:bg-zinc-950"
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
          name="full_description"
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck label="Full Description" checked={!!field.value} />
              <FormControl>
                <Textarea
                  placeholder="Describe your project in detail..."
                  className="text-zinc-400 h-24 w-full dark:bg-zinc-950"
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
          name="tracks"
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck label="Tracks" checked={field.value.length>0} />
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
        <h3 className="font-medium  text-lg md:text-xl">
          Team &amp; Collaboration
        </h3>
        {/* Campo de búsqueda */}
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:bg-zinc-950"
            size={20}
          />
          <Input
            placeholder="Search team member by email or name "
            className=" w-full pl-10 dark:bg-zinc-950"
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
              <TableRow>
                <TableHead >Name</TableHead>
                <TableHead >Email</TableHead>
                <TableHead >Role</TableHead>
                <TableHead >Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member, index) => (
                <TableRow key={index} className="hover:bg-[#2c2c2c]">
                  <TableCell>{member.name}</TableCell>
                  <TableCell >{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell >{member.status}</TableCell>
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
