import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar
} from '@/components/ui/sidebar';
import { CalendarIcon, Home, MicVocal, Trophy } from 'lucide-react';
import React from 'react';
const items = [
  {
    title: 'General',
    icon: Home,
    isActive: true,
  },
  {
    title: 'Speakers & Judges',
    icon: MicVocal,
  },
  {
    title: 'Schedule',
    icon: CalendarIcon,
  },
  {
    title: 'Prizes & Tracks',
    icon: Trophy,
  },
];

export default function AdminSidebar() {
  return (
    <Sidebar className='!border-r-0 hidden md:block' collapsible='icon'>
      <SidebarContent className='bg-zinc-950'>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.isActive}>
                    <item.icon className='w-4 h-4 stroke-white' />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

