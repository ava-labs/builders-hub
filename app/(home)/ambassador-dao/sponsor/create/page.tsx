"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Import editor component
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Code,
  Image,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const createJobListing = async (data: {
  title: string;
  description: string;
  prize: number;
  currency: string;
  deadline: Date | null;
  deadlinePeriod: string;
  skills: string[];
  contact: string;
  questions: string[];
}) => {
  return fetch("/api/job-listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => res.json());
};

export default function AmbasssadorDaoSponsorsCreateListingPage() {
  const router = useRouter();

  // State for form data
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    prize: number;
    currency: string;
    deadline: Date | null;
    deadlinePeriod: string;
    skills: string[];
    contact: string;
    questions: string[];
  }>({
    title: "Create a High-Energy Video Montage About Sendit & Earn!",
    description: "",
    prize: 100,
    currency: "USDC",
    deadline: null,
    deadlinePeriod: "",
    skills: [],
    contact: "Johndoe@AmbassadorDAO.com",
    questions: [""],
  });

  // State for new skill input
  const [newSkill, setNewSkill] = useState("");

  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Add a skill badge
  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill)) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill],
      }));
      setNewSkill("");
    }
  };

  // Add a custom question
  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, ""],
    }));
  };

  // Rich text buttons - in a real app these would modify the editor state
  const editorButtons = [
    { icon: <Bold className='h-4 w-4' />, action: () => {} },
    { icon: <Italic className='h-4 w-4' />, action: () => {} },
    { icon: <Underline className='h-4 w-4' />, action: () => {} },
    { icon: <Heading1 className='h-4 w-4' />, action: () => {} },
    { icon: <Heading2 className='h-4 w-4' />, action: () => {} },
    { icon: <Heading3 className='h-4 w-4' />, action: () => {} },
    { icon: <Link className='h-4 w-4' />, action: () => {} },
    { icon: <Code className='h-4 w-4' />, action: () => {} },
    { icon: <Image className='h-4 w-4' />, action: () => {} },
  ];

  // Submit form using react-query
  const mutation = useMutation({
    mutationFn: createJobListing,
    onSuccess: () => {
      router.push("/listings");
    },
  });

  const handleSubmit = () => {
    mutation.mutate(formData);
  };

  const goBack = () => {
    router.back();
  };

  return (
    <div className='min-h-screen bg-black text-white p-4'>
      <div className='max-w-7xl mx-auto'>
        <div className='flex justify-between mb-8'>
          <Button
            variant='outline'
            onClick={goBack}
            className='text-white border-gray-700'
          >
            <ArrowLeft className='mr-2 h-4 w-4' /> Go Back
          </Button>

          <div className='flex space-x-2'>
            <Button variant='outline' className='text-white border-gray-700'>
              Preview
            </Button>
            <Button
              onClick={handleSubmit}
              className='bg-red-500 hover:bg-red-600'
            >
              Continue
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-2 space-y-6'>
            {/* Title Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                Listing Title
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <div className='flex items-center space-x-2'>
                <Select defaultValue='job' onValueChange={(value) => {}}>
                  <SelectTrigger className='w-32 bg-gray-900 border-gray-700'>
                    <SelectValue placeholder='Select' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='job'>Job</SelectItem>
                    <SelectItem value='bounty'>Bounty</SelectItem>
                    <SelectItem value='contest'>Contest</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  className='flex-1 bg-gray-900 border-gray-700'
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                />
              </div>
            </div>

            {/* Description Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                Description
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <div className='rounded-md bg-gray-900 overflow-hidden'>
                <div className='flex p-2 border-b border-gray-800'>
                  {editorButtons.map((button, i) => (
                    <Button
                      key={i}
                      variant='ghost'
                      size='icon'
                      onClick={button.action}
                      className='h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800'
                    >
                      {button.icon}
                    </Button>
                  ))}
                </div>
                <Textarea
                  className='border-0 bg-gray-900 resize-none min-h-64'
                  placeholder='Describe your project in detail. What does it do? Who is it for?'
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className='lg:col-span-1 space-y-6'>
            {/* Prize Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                First Prize
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <div className='flex items-center space-x-2'>
                <Select
                  defaultValue='USDC'
                  onValueChange={(value) => handleChange("currency", value)}
                >
                  <SelectTrigger className='w-32 bg-gray-900 border-gray-700'>
                    <div className='flex items-center'>
                      <div className='w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-2'>
                        $
                      </div>
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='USDC'>USDC</SelectItem>
                    <SelectItem value='ETH'>ETH</SelectItem>
                    <SelectItem value='BTC'>BTC</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type='number'
                  className='flex-1 bg-gray-900 border-gray-700'
                  value={formData.prize}
                  onChange={(e) => handleChange("prize", e.target.value)}
                />
              </div>
            </div>

            {/* Users Section */}
            <div className='space-y-2'>
              <div className='flex justify-between'>
                <span className='text-sm font-medium'>Individual Assign</span>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 text-xs text-blue-400'
                >
                  <Plus className='h-3 w-3 mr-1' /> Add Individual Person
                </Button>
              </div>
              <div className='flex -space-x-2'>
                <Avatar className='border-2 border-gray-900 bg-purple-500'>
                  <AvatarFallback>S</AvatarFallback>
                </Avatar>
                <Avatar className='border-2 border-gray-900 bg-blue-500'>
                  <AvatarFallback>H</AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Deadline Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                Deadline (in America/New_York)
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <div className='flex flex-col space-y-2'>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='bg-gray-900 border-gray-700 justify-between text-left font-normal'
                    >
                      {formData.deadline ? (
                        format(formData.deadline, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className='h-4 w-4 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      selected={formData.deadline || undefined}
                      onSelect={(date) => handleChange("deadline", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <div className='flex space-x-2'>
                  {["1 Week", "2 Weeks", "3 Weeks"].map((period, i) => (
                    <Button
                      key={period}
                      variant='outline'
                      className={cn(
                        "bg-gray-900 border-gray-700",
                        formData.deadlinePeriod === period &&
                          "border-blue-500 bg-blue-500/10"
                      )}
                      onClick={() => handleChange("deadlinePeriod", period)}
                    >
                      {period}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Skills Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                Skills Needed
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <div className='relative'>
                <Input
                  className='bg-gray-900 border-gray-700 pr-10'
                  placeholder='Badge'
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                />
                <Button
                  size='icon'
                  variant='ghost'
                  onClick={addSkill}
                  className='absolute right-0 top-0 h-full px-3 text-gray-400'
                >
                  <Plus className='h-4 w-4' />
                </Button>
              </div>

              <div className='flex flex-wrap gap-2 mt-2'>
                {formData.skills.map((skill, i) => (
                  <Badge
                    key={i}
                    variant='outline'
                    className='bg-gray-800 hover:bg-gray-700'
                  >
                    {skill}
                    <Button
                      size='icon'
                      variant='ghost'
                      className='h-4 w-4 ml-1 hover:bg-gray-700 p-0'
                      onClick={() => {
                        const updatedSkills = formData.skills.filter(
                          (_, idx) => idx !== i
                        );
                        handleChange("skills", updatedSkills);
                      }}
                    >
                      <Plus className='h-3 w-3 rotate-45' />
                    </Button>
                  </Badge>
                ))}
                {!formData.skills.length &&
                  Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <Badge key={i} variant='outline' className='bg-gray-800'>
                        Badge <Plus className='h-3 w-3 ml-1' />
                      </Badge>
                    ))}
              </div>
            </div>

            {/* Contact Section */}
            <div className='space-y-2'>
              <label className='flex text-sm font-medium'>
                Point of Contact (TG / X / Email)
                <span className='text-red-500 ml-1'>*</span>
              </label>
              <Input
                className='bg-gray-900 border-gray-700'
                value={formData.contact}
                onChange={(e) => handleChange("contact", e.target.value)}
              />
            </div>

            {/* Questions Section */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Custom Questions</h3>

              {formData.questions.map((question, i) => (
                <div key={i} className='space-y-2'>
                  <label className='flex text-sm font-medium'>
                    Question {i + 1}
                    <span className='text-red-500 ml-1'>*</span>
                  </label>
                  <Select>
                    <SelectTrigger className='bg-gray-900 border-gray-700'>
                      <SelectValue placeholder='Select question type' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='text'>Text</SelectItem>
                      <SelectItem value='multiline'>Multiline Text</SelectItem>
                      <SelectItem value='choice'>Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <Button
                variant='outline'
                onClick={addQuestion}
                className='w-full bg-transparent border-gray-700 hover:bg-gray-800'
              >
                <Plus className='h-4 w-4 mr-2' /> Add Question
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
