import { Pickaxe, Tag, Users,Image } from 'lucide-react'
import React from 'react'

export default function SideBarComponet() {
  return (
    <div className="w-16 flex flex-col items-center bg-zinc-900  mt-6   px-2 py-2 gap-2 border border-zinc-800">
    <div className="p-2 gap-2.5 space-y-4">
    <Tag className="cursor-pointer " color="#4F4F55" />
    <Users className="cursor-pointer" color="#4F4F55" />
    <Pickaxe className="cursor-pointer" color="#4F4F55"  />
    <Image className="cursor-pointer" color="#4F4F55" />
    </div>
  </div>

  )
}
