// MediaUploader.tsx
'use client';

import React, { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, BadgeAlert, PlusCircleIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { SubmissionForm } from '../hooks/useSubmissionFormSecure';
import { EventsLang, t } from '@/lib/events/i18n';

type MediaUploaderProps = {
  name: keyof SubmissionForm;
  label: string;
  maxItems: number;
  maxSizeMB: number;
  recommendedSize?: string;
  accept?: string;
  width?: string;
  height?: string;
  extraText?: string;
  buttonText?: string;
  lang?: EventsLang;
};

export default function MediaUploader({
  name,
  label,
  maxItems,
  maxSizeMB,
  recommendedSize,
  accept = 'image/png, image/jpeg, image/svg+xml',
  width = 'sm:max-w-[128px]',
  height = 'sm:max-h-[128px]',
  extraText = '',
  buttonText = 'Upload',
  lang = 'en',
}: MediaUploaderProps) {
  const form = useFormContext<SubmissionForm>();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleReplace = (index: number) => {
    setSelectedIndex(index);
    replaceInputRef.current?.click();
  };

  const handleReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedIndex !== null) {
      const newFile = e.target.files[0];
      if (!newFile) return;
      const currentValue = form.getValues(name);
      if (maxItems === 1) {
        form.setValue(name, newFile);
      } else {
        const currentFiles = Array.isArray(currentValue)
          ? currentValue
          : [currentValue];
        currentFiles[selectedIndex] = newFile;
        form.setValue(name, currentFiles);
      }
    }
  };

  const handleDelete = (index: number) => {
    setSelectedIndex(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedIndex === null) return;
    const currentValue = form.getValues(name);
    const currentFiles = Array.isArray(currentValue)
      ? currentValue
      : [currentValue];
    currentFiles.splice(selectedIndex, 1);
    form.setValue(name, currentFiles.length === 0 ? null : currentFiles);
    setDeleteDialogOpen(false);
  };

  const handleView = (index: number) => {
    setSelectedIndex(index);
    setViewDialogOpen(true);
  };

  const sizeClasses = `${width} ${height}`;

  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => {
        const value = field.value;
        const fileArray = Array.isArray(value) ? value : value ? [value] : [];

        return (
          <FormItem className='space-y-2'>
            <FormLabel className='text-sm text-foreground font-semibold'>
              {label}
            </FormLabel>

            <div
              className={`grid gap-2  ${
                maxItems > 1
                  ? 'grid-cols-2 sm:grid-cols-3 md:inline-flex '
                  : 'inline-flex'
              }`}
            >
              {fileArray.length === 0 ? (
                <div
                  className={`relative border-2 py-4 px-4 dark:bg-zinc-800  border-dashed border-red-500 rounded-md w-full flex items-center justify-center ${sizeClasses}`}
                >
                  <div className='bg-white w-full  h-full flex items-center justify-center rounded-md'>
                    <ImageIcon
                      className='text-red-500'
                      size={64}
                      color='black'
                    />
                  </div>
                </div>
              ) : (
                fileArray.map((file, index) => {
                  let previewUrl: string;
                  if (typeof file === 'string') {
                    previewUrl = file;
                  } else if (file instanceof Blob) {
                    previewUrl = URL.createObjectURL(file);
                  } else {
                    console.error(
                      'The element is neither a Blob nor a valid string:',
                      file
                    );
                    return null;
                  }
                  return (
                    <DropdownMenu key={index}>
                      <DropdownMenuTrigger asChild>
                        <div
                          className={`relative border-2 py-4 px-4 border-dashed border-red-500 rounded-md w-full h-full flex items-center justify-center cursor-pointer ${sizeClasses}`}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <img
                            src={previewUrl}
                            alt='Preview'
                            className='w-full h-full object-contain rounded-md'
                          />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleView(index)}>
                          {t(lang, "submission.media.view")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReplace(index)}>
                          {t(lang, "submission.media.replace")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(index)}>
                          {t(lang, "submission.media.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })
              )}
            </div>

            <div className='flex flex-col'>
              <Button
                variant='outline'
                type='button'
                onClick={handleUploadClick}
                className='flex gap-2 w-fit dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:text-black'
                disabled={fileArray.length >= maxItems}
              >
                <PlusCircleIcon className='w-4 h-4' />
                {buttonText}
              </Button>
            </div>

            <FormControl>
              <input
                ref={uploadInputRef}
                type='file'
                className='hidden'
                accept={accept}
                multiple={maxItems > 1}
                onChange={(e) => {
                  if (!e.target.files) return;

                  const files = Array.from(e.target.files);

                  if (maxItems === 1) {
                    field.onChange(files[0]);
                  } else {
                    const existingFiles = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const totalFiles = [...existingFiles, ...files].slice(
                      0,
                      maxItems
                    );
                    field.onChange(totalFiles);
                  }
                }}
              />
            </FormControl>

            <input
              ref={replaceInputRef}
              type='file'
              className='hidden'
              accept={accept}
              onChange={handleReplaceChange}
            />

            <p className='text-sm text-zinc-400 leading-tight mt-2'>
              {extraText && (
                <>
                  {extraText}
                  <br />
                </>
              )}
              {t(lang, "submission.media.fileRequirements")} <br />
              {recommendedSize && t(lang, "submission.media.recommendedSize", { size: recommendedSize })}
              <br />
              {t(lang, "submission.media.maxSize", { size: maxSizeMB })}
            </p>

            <FormMessage />

            {/* Dialogs */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent className='bg-zinc-900 border border-zinc-400 max-w-md w-full px-4'>
                <DialogHeader className='flex flex-col '>
                  <DialogTitle className='text-white text-lg pb-3'>
                    {t(lang, "submission.media.deleteTitle")}
                  </DialogTitle>
                </DialogHeader>
                <Card
                  className='border border-red-500 w-[95%] sm:w-[85%] md:w-full h-auto max-h-[190px]
  rounded-md p-4 sm:p-6 gap-4 bg-zinc-800 text-white mx-auto
  flex flex-col items-center justify-center text-center'
                >
                  <BadgeAlert className='w-9 h-9' color='rgb(239 68 68)' />
                  <DialogDescription className='text-red-500 text-md'>
                    {t(lang, "submission.media.deleteConfirm")}
                  </DialogDescription>
                  <Button
                    onClick={confirmDelete}
                    className=' bg-white hover:bg-zinc-400 text-black w-full max-w-[73px] '
                  >
                    {t(lang, "submission.media.delete")}
                  </Button>
                </Card>
              </DialogContent>
            </Dialog>

            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
              <DialogContent className='bg-zinc-900 max-w-[600px] w-full px-4'>
                <DialogHeader>
                  <DialogTitle>{t(lang, "submission.media.viewTitle")}</DialogTitle>
                </DialogHeader>
                {(() => {
                  if (selectedIndex === null) return null;
                  const value = form.getValues(name);
                  const files = Array.isArray(value)
                    ? value
                    : value
                    ? [value]
                    : [];
                  const file = files[selectedIndex];
                  if (!file) return null;
                  const previewUrl =
                    typeof file === 'string'
                      ? file
                      : URL.createObjectURL(file as Blob);
                  return (
                    <div className='flex justify-center'>
                      <img
                        src={previewUrl}
                        alt='Full Preview'
                        className='max-h-[80vh] object-contain'
                      />
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </FormItem>
        );
      }}
    />
  );
}
