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
import { Input } from "@/components/ui/input";
import { BadgeAlert, ImageIcon } from "lucide-react";
import { SubmissionForm } from "./General";

export default function FileUploadScreenShots() {
  const form = useFormContext<SubmissionForm>();

  // Referencias y estados para Project Logo
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [logoDeleteDialogOpen, setLogoDeleteDialogOpen] = useState(false);
  const [logoViewDialogOpen, setLogoViewDialogOpen] = useState(false);
  const [logoSelectedIndex, setLogoSelectedIndex] = useState<number | null>(null);

  // Referencias y estados para Cover Image
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [coverDeleteDialogOpen, setCoverDeleteDialogOpen] = useState(false);
  const [coverViewDialogOpen, setCoverViewDialogOpen] = useState(false);
  const [coverSelectedIndex, setCoverSelectedIndex] = useState<number | null>(null);

  // Referencias y estados para Screenshots
  const screenshotFileInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotFileReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [screenshotDeleteDialogOpen, setScreenshotDeleteDialogOpen] = useState(false);
  const [screenshotViewDialogOpen, setScreenshotViewDialogOpen] = useState(false);
  const [screenshotSelectedIndex, setScreenshotSelectedIndex] = useState<number | null>(null);

  // Handlers para Project Logo
  const handleLogoUploadClick = () => logoFileInputRef.current?.click();
  const handleLogoReplace = (index: number) => {
    setLogoSelectedIndex(index);
    logoFileReplaceInputRef.current?.click();
  };
  const handleLogoReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && logoSelectedIndex !== null) {
      const newFile = e.target.files[0];
      if (!newFile) return;
      const currentFiles = form.getValues("logoFile") || [];
      currentFiles[logoSelectedIndex] = newFile;
      form.setValue("logoFile", currentFiles);
    }
  };
  const handleLogoDelete = (index: number) => {
    setLogoSelectedIndex(index);
    setLogoDeleteDialogOpen(true);
  };
  const confirmLogoDelete = () => {
    if (logoSelectedIndex === null) return;
    const currentFiles = form.getValues("logoFile") || [];
    currentFiles.splice(logoSelectedIndex, 1);
    form.setValue("logoFile", currentFiles);
    setLogoDeleteDialogOpen(false);
  };
  const handleLogoView = (index: number) => {
    setLogoSelectedIndex(index);
    setLogoViewDialogOpen(true);
  };

  // Handlers para Cover Image
  const handleCoverUploadClick = () => coverFileInputRef.current?.click();
  const handleCoverReplace = (index: number) => {
    setCoverSelectedIndex(index);
    coverFileReplaceInputRef.current?.click();
  };
  const handleCoverReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && coverSelectedIndex !== null) {
      const newFile = e.target.files[0];
      if (!newFile) return;
      const currentFiles = form.getValues("coverFile") || [];
      currentFiles[coverSelectedIndex] = newFile;
      form.setValue("coverFile", currentFiles);
    }
  };
  const handleCoverDelete = (index: number) => {
    setCoverSelectedIndex(index);
    setCoverDeleteDialogOpen(true);
  };
  const confirmCoverDelete = () => {
    if (coverSelectedIndex === null) return;
    const currentFiles = form.getValues("coverFile") || [];
    currentFiles.splice(coverSelectedIndex, 1);
    form.setValue("coverFile", currentFiles);
    setCoverDeleteDialogOpen(false);
  };
  const handleCoverView = (index: number) => {
    setCoverSelectedIndex(index);
    setCoverViewDialogOpen(true);
  };

  // Handlers para Screenshots
  const handleScreenshotUploadClick = () => screenshotFileInputRef.current?.click();
  const handleScreenshotReplace = (index: number) => {
    setScreenshotSelectedIndex(index);
    screenshotFileReplaceInputRef.current?.click();
  };
  const handleScreenshotReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && screenshotSelectedIndex !== null) {
      const newFile = e.target.files[0];
      if (!newFile) return;
      const currentFiles = form.getValues("screenshots") || [];
      currentFiles[screenshotSelectedIndex] = newFile;
      form.setValue("screenshots", currentFiles);
    }
  };
  const handleScreenshotDelete = (index: number) => {
    setScreenshotSelectedIndex(index);
    setScreenshotDeleteDialogOpen(true);
  };
  const confirmScreenshotDelete = () => {
    if (screenshotSelectedIndex === null) return;
    const currentFiles = form.getValues("screenshots") || [];
    currentFiles.splice(screenshotSelectedIndex, 1);
    form.setValue("screenshots", currentFiles);
    setScreenshotDeleteDialogOpen(false);
  };
  const handleScreenshotView = (index: number) => {
    setScreenshotSelectedIndex(index);
    setScreenshotViewDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-foreground">
        3) Visual Identity & Media
      </h2>
      <p className="text-sm text-zinc-400">
        Upload images and media to visually represent your project.
      </p>

      {/* Project Logo */}
      <section className="space-y-2">
        <FormField
          control={form.control}
          name="logoFile"
          render={({ field }) => {
            const fileArray = field.value ? Array.from(field.value) : [];

            return (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm text-foreground font-semibold">
                  Project Logo
                </FormLabel>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {fileArray.length === 0 ? (
                    <div className="relative border-2 border-dashed py-3 px-3 border-red-500 bg-zinc-800 rounded-md w-full sm:max-w-[128px] sm:max-h-[128px] flex items-center justify-center">
                      <div className="bg-white w-full sm:max-w-[88px] h-full flex items-center justify-center rounded-md">
                        <ImageIcon className="text-red-500" size={64} color="black" />
                      </div>
                    </div>
                  ) : (
                    fileArray.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file as Blob);
                      return (
                        <DropdownMenu key={index}>
                          <DropdownMenuTrigger asChild>
                            <div
                              className="relative border-2 border-dashed py-3 px-3 border-red-500 rounded-md w-full sm:max-w-[128px] sm:max-h-[128px] flex items-center justify-center cursor-pointer"
                              onClick={() => setLogoSelectedIndex(index)}
                            >
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-contain rounded-md"
                              />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleLogoView(index)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLogoReplace(index)}>
                              Replace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLogoDelete(index)}>
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
                    onClick={handleLogoUploadClick}
                    className="flex gap-2 w-max max-w-[137px] bg-white text-black hover:bg-gray-200"
                  >
                    Upload Logo
                  </Button>
                </div>

                <FormControl>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files).slice(0, 1);
                        field.onChange(newFiles);
                      }
                    }}
                  />
                </FormControl>

                <input
                  ref={logoFileReplaceInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleLogoReplaceChange}
                />

                <p className="text-xs text-zinc-500 leading-tight mt-2">
                  File requirements: PNG, JPG, SVG <br />
                  Recommended size: 512 x 512px (square format) <br />
                  Max file size: 1MB
                </p>

                <FormMessage />
              </FormItem>
            );
          }}
        />
      </section>

      {/* Cover Image */}
      <section className="space-y-2">
        <FormField
          control={form.control}
          name="coverFile"
          render={({ field }) => {
            const fileArray = field.value ? Array.from(field.value) : [];

            return (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm text-foreground font-semibold">
                  Cover Image
                </FormLabel>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fileArray.length === 0 ? (
                    <div className="relative border-2 border-dashed py-3 px-3 border-red-500 bg-zinc-800 rounded-md w-full sm:max-w-[288px] sm:max-h-[108px] flex items-center justify-center">
                      <div className="bg-white w-full sm:max-w-[88px] h-full flex items-center justify-center rounded-md">
                        <ImageIcon className="text-red-500" size={64} color="black" />
                      </div>
                    </div>
                  ) : (
                    fileArray.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file as Blob);
                      return (
                        <DropdownMenu key={index}>
                          <DropdownMenuTrigger asChild>
                            <div
                              className="relative border-2 border-dashed py-3 px-3 border-red-500 rounded-md w-full sm:max-w-[288px] sm:max-h-[108px] flex items-center justify-center cursor-pointer"
                              onClick={() => setCoverSelectedIndex(index)}
                            >
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-contain rounded-md"
                              />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleCoverView(index)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCoverReplace(index)}>
                              Replace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCoverDelete(index)}>
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
                    onClick={handleCoverUploadClick}
                    className="flex gap-2 w-max max-w-[137px] bg-white text-black hover:bg-gray-200"
                  >
                    Upload Cover
                  </Button>
                </div>

                <FormControl>
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files).slice(0, 1);
                        field.onChange(newFiles);
                      }
                    }}
                  />
                </FormControl>

                <input
                  ref={coverFileReplaceInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleCoverReplaceChange}
                />

                <p className="text-xs text-zinc-500 leading-tight mt-2">
                  File requirements: PNG, JPG, SVG <br />
                  Recommended size: 840 x 300px (16:9 aspect ratio) <br />
                  Max file size: 2MB
                </p>

                <FormMessage />
              </FormItem>
            );
          }}
        />
      </section>

      {/* Screenshots */}
      <section className="space-y-2">
        <FormField
          control={form.control}
          name="screenshots"
          render={({ field }) => {
            const fileArray = field.value ? Array.from(field.value) : [];

            return (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm text-foreground font-semibold">
                  Screenshots
                </FormLabel>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {fileArray.length === 0 ? (
                    <div className="relative border-2 border-dashed py-3 px-3 border-red-500 bg-zinc-800 rounded-md w-full sm:max-w-[128px] sm:max-h-[128px] flex items-center justify-center">
                      <div className="bg-white w-full sm:max-w-[88px] h-full flex items-center justify-center rounded-md">
                        <ImageIcon className="text-red-500" size={64} color="black" />
                      </div>
                    </div>
                  ) : (
                    fileArray.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file as Blob);
                      return (
                        <DropdownMenu key={index}>
                          <DropdownMenuTrigger asChild>
                            <div
                              className="relative border-2 border-dashed py-3 px-3 border-red-500 rounded-md w-full sm:max-w-[128px] sm:max-h-[128px] flex items-center justify-center cursor-pointer"
                              onClick={() => setScreenshotSelectedIndex(index)}
                            >
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-contain rounded-md"
                              />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleScreenshotView(index)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScreenshotReplace(index)}>
                              Replace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScreenshotDelete(index)}>
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
                    onClick={handleScreenshotUploadClick}
                    className="flex gap-2 w-max max-w-[137px] bg-white text-black hover:bg-gray-200"
                    disabled={fileArray.length >= 5}
                  >
                    Upload Image
                  </Button>
                </div>

                <FormControl>
                  <input
                    ref={screenshotFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/svg+xml"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        const existingFiles = field.value ? Array.from(field.value) : [];
                        const totalFiles = [...existingFiles, ...newFiles].slice(0, 5);
                        field.onChange(totalFiles);
                      }
                    }}
                  />
                </FormControl>

                <input
                  ref={screenshotFileReplaceInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleScreenshotReplaceChange}
                />

                <p className="text-xs text-zinc-500 leading-tight mt-2">
                  Upload up to 5 screenshots that showcase your project <br />
                  File requirements: PNG, JPG, SVG <br />
                  No specific size required, but ensure clarity and readability <br />
                  Max file size: 1MB
                </p>

                <FormMessage />
              </FormItem>
            );
          }}
        />
      </section>

      {/* Demo Video */}
      <section className="space-y-2">
        <FormField
          control={form.control}
          name="demoVideoLink"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-sm text-foreground font-semibold">
                Demo Video
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Paste your video link (e.g., YouTube, Vimeo, or other supported platform)"
                  className="bg-zinc-800 text-white border-zinc-600"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-zinc-500 leading-tight mt-2">
                Showcase your project in action with a short demo video. Ensure the link is accessible and not set to private. <br />
                Video requirements: <br />
                - Minimum resolution: 720p <br />
                - Ensure audio is clear, no background music <br />
                - Platforms supported: YouTube, Vimeo, Google Drive (public link)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      {/* Dialog para Project Logo */}
      <Dialog open={logoDeleteDialogOpen} onOpenChange={setLogoDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border border-red-500 max-w-md w-full px-4">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-red-400 text-lg font-semibold">
              Delete Image
            </DialogTitle>
            <div className="mt-4">
              <BadgeAlert className="w-12 h-12 text-red-500" />
            </div>
          </DialogHeader>
          <div className="text-center">
            <DialogDescription className="text-red-200 text-sm">
              Are you sure you want to delete this image?
            </DialogDescription>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setLogoDeleteDialogOpen(false)}
              className="text-white border-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLogoDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoViewDialogOpen} onOpenChange={setLogoViewDialogOpen}>
        <DialogContent className="bg-zinc-900 max-w-[600px] w-full px-4">
          <DialogHeader>
            <DialogTitle>View Image</DialogTitle>
          </DialogHeader>
          {(() => {
            if (logoSelectedIndex === null) return null;
            const files = form.getValues("logoFile") || [];
            const file = files[logoSelectedIndex];
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

      {/* Dialog para Cover Image */}
      <Dialog open={coverDeleteDialogOpen} onOpenChange={setCoverDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border border-red-500 max-w-md w-full px-4">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-red-400 text-lg font-semibold">
              Delete Image
            </DialogTitle>
            <div className="mt-4">
              <BadgeAlert className="w-12 h-12 text-red-500" />
            </div>
          </DialogHeader>
          <div className="text-center">
            <DialogDescription className="text-red-200 text-sm">
              Are you sure you want to delete this image?
            </DialogDescription>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCoverDeleteDialogOpen(false)}
              className="text-white border-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCoverDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coverViewDialogOpen} onOpenChange={setCoverViewDialogOpen}>
        <DialogContent className="bg-zinc-900 max-w-[600px] w-full px-4">
          <DialogHeader>
            <DialogTitle>View Image</DialogTitle>
          </DialogHeader>
          {(() => {
            if (coverSelectedIndex === null) return null;
            const files = form.getValues("coverFile") || [];
            const file = files[coverSelectedIndex];
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

      {/* Dialog para Screenshots */}
      <Dialog open={screenshotDeleteDialogOpen} onOpenChange={setScreenshotDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border border-red-500 max-w-md w-full px-4">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-red-400 text-lg font-semibold">
              Delete Image
            </DialogTitle>
            <div className="mt-4">
              <BadgeAlert className="w-12 h-12 text-red-500" />
            </div>
          </DialogHeader>
          <div className="text-center">
            <DialogDescription className="text-red-200 text-sm">
              Are you sure you want to delete this image?
            </DialogDescription>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setScreenshotDeleteDialogOpen(false)}
              className="text-white border-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmScreenshotDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={screenshotViewDialogOpen} onOpenChange={setScreenshotViewDialogOpen}>
        <DialogContent className="bg-zinc-900 max-w-[600px] w-full px-4">
          <DialogHeader>
            <DialogTitle>View Image</DialogTitle>
          </DialogHeader>
          {(() => {
            if (screenshotSelectedIndex === null) return null;
            const files = form.getValues("screenshots") || [];
            const file = files[screenshotSelectedIndex];
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
    </div>
  );
}
