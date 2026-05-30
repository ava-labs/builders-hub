'use client'

import type { ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

interface ChartDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

export function ChartDetailSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ChartDetailSheetProps) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="p-4 overflow-auto">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
