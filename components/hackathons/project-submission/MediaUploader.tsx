// MediaUploader.tsx
"use client";

import React, { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageIcon, BadgeAlert } from "lucide-react";
import { SubmissionForm } from "./General";
import { Card } from "@/components/ui/card";

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
};

export default function MediaUploader({
  name,
  label,
  maxItems,
  maxSizeMB,
  recommendedSize,
  accept = "image/png, image/jpeg, image/svg+xml",
  width = "sm:max-w-[128px]",
  height = "sm:max-h-[128px]",
  extraText=""

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
      const currentFiles = form.getValues(name) || [];
      currentFiles[selectedIndex] = newFile;
      form.setValue(name, currentFiles);
    }
  };

  const handleDelete = (index: number) => {
    setSelectedIndex(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedIndex === null) return;
    const currentFiles = form.getValues(name) || [];
    currentFiles.splice(selectedIndex, 1);
    form.setValue(name, currentFiles);
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
        const fileArray = field.value ? Array.from(field.value) : [];

        return (
          <FormItem className="space-y-2">
            <FormLabel className="text-sm text-foreground font-semibold">
              {label}
            </FormLabel>

            <div
              className={`grid gap-2  ${
                maxItems > 1
                  ? "grid-cols-2 sm:grid-cols-3 md:inline-flex "
                  : "inline-flex"
              }`}
            >
              {fileArray.length === 0 ? (
                <div
                  className={`relative border-2 py-4 px-4 bg-zinc-800  border-dashed border-red-500 rounded-md w-full flex items-center justify-center ${sizeClasses}`}
                >
                  <div className="bg-white w-full  h-full flex items-center justify-center rounded-md">
                    <ImageIcon
                      className="text-red-500"
                      size={64}
                      color="black"
                    />
                  </div>
                </div>
              ) : (
                fileArray.map((file, index) => {
                  const previewUrl = URL.createObjectURL(file as Blob);
                  return (
                    <DropdownMenu key={index}>
                      <DropdownMenuTrigger asChild>
                        <div
                          className={`relative border-2 py-4 px-4 border-dashed border-red-500 rounded-md w-full h-full flex items-center justify-center cursor-pointer ${sizeClasses}`}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-full object-contain rounded-md"
                          />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleView(index)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReplace(index)}>
                          Replace
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(index)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })
              )}
            </div>

            <div className="flex flex-col">
              <Button
                variant="secondary"
                onClick={handleUploadClick}
                className="flex gap-2 w-max max-w-[137px] bg-white text-black hover:bg-gray-200"
                disabled={fileArray.length >= maxItems}
              >
                Upload {label.split(" ")[0]}
              </Button>
            </div>

            <FormControl>
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept={accept}
                multiple={maxItems > 1}
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files);
                    const existingFiles = field.value
                      ? Array.from(field.value)
                      : [];
                    const totalFiles = [...existingFiles, ...newFiles].slice(
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
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleReplaceChange}
            />

            <p className="text-sm text-zinc-400 leading-tight mt-2">
              {extraText && (
                <>
                  {extraText}
                  <br />
                </>
              )}
              File requirements: PNG, JPG, SVG <br />
              {recommendedSize && `Recommended size: ${recommendedSize}`}
              <br />
              Max file size: {maxSizeMB}MB
            </p>

            <FormMessage />

            {/* Dialogs */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent className="bg-zinc-900 border border-zinc-400 max-w-md w-full px-4">
                <DialogHeader className="flex flex-col ">
                  <DialogTitle className="text-white text-lg pb-3">
                    Delete Image
                  </DialogTitle>
                </DialogHeader>
                <Card
  className="border border-red-500 w-[95%] sm:w-[85%] md:w-full h-auto max-h-[190px]
  rounded-md p-4 sm:p-6 gap-4 bg-zinc-800 text-white mx-auto
  flex flex-col items-center justify-center text-center"
                >
                  <BadgeAlert className="w-9 h-9" color="rgb(239 68 68)" />
                  <DialogDescription className="text-red-500 text-md">
                    Are you sure you want to delete this image?
                  </DialogDescription>
                  <Button
                  
                    onClick={confirmDelete}
                    className=" bg-white hover:bg-zinc-400 text-black w-full max-w-[73px] "
                  >
                    Delete
                  </Button>
                </Card>
           
              </DialogContent>
            </Dialog>

            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
              <DialogContent className="bg-zinc-900 max-w-[600px] w-full px-4">
                <DialogHeader>
                  <DialogTitle>View Image</DialogTitle>
                </DialogHeader>
                {(() => {
                  if (selectedIndex === null) return null;
                  const files = form.getValues(name) || [];
                  const file = files[selectedIndex];
                  if (!file) return null;
                  const previewUrl = URL.createObjectURL(file);
                  return (
                    <div className="flex justify-center">
                      <img
                        src={previewUrl}
                        alt="Full Preview"
                        className="max-h-[80vh] object-contain"
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