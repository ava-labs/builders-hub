"use client";

import { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import { Upload } from 'lucide-react';

interface JobApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
}

const JobApplicationModal: React.FC<JobApplicationModalProps> = ({
  isOpen,
  onClose,
  jobTitle = "Job"
}) => {
  const [name, setName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (1MB max)
      if (file.size > 1024 * 1024) {
        alert("File size exceeds 1MB limit");
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // Check file size
      if (file.size > 1024 * 1024) {
        alert("File size exceeds 1MB limit");
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBrowse = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!name || !telegram || !experienceLevel) return;
    
    // Create form data for submission
    const formData = new FormData();
    formData.append('name', name);
    formData.append('telegram', telegram);
    formData.append('experienceLevel', experienceLevel);
    if (profileImage) formData.append('profileImage', profileImage);
    if (additionalInfo) formData.append('additionalInfo', additionalInfo);
    
    // Here you would send formData to your API
    console.log('Submitting application:', {
      name,
      telegram,
      experienceLevel,
      profileImage: profileImage ? profileImage.name : null,
      additionalInfo
    });
    
    // Reset form
    setName('');
    setTelegram('');
    setExperienceLevel('');
    setProfileImage(null);
    setImagePreview(null);
    setAdditionalInfo('');
    
    // Close modal
    onClose();
    
    // Optional: Show success message
    alert('Your application has been submitted successfully!');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Your Application"
      description="Don't start working just yet! Apply first, and then begin working only once you've been hired for the project by the sponsor. Please note that the sponsor might contact you to assess fit before picking the winner."
    >
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-white">
                Name
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                required
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-white">
                Your telegram
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="Your telegram"
                required
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-white">
                Experience Level
                <span className="text-red-500">*</span>
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                required
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none appearance-none"
              >
                <option value="" disabled>Experience Level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-white">
                Upload Profile Image or Avatar
              </label>
              <p className="text-sm text-gray-400 mb-2">Add the image here. Recommended size: 512 × 512px (square format)</p>
              
              <div 
                className={`border-2 border-dashed border-gray-700 rounded-md p-6 text-center ${imagePreview ? 'bg-gray-900' : 'bg-[#111]'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={imagePreview} 
                      alt="Profile preview" 
                      className="w-32 h-32 object-cover rounded-md mb-4" 
                    />
                    <button 
                      type="button" 
                      className="text-red-500 hover:text-red-400"
                      onClick={() => {
                        setProfileImage(null);
                        setImagePreview(null);
                      }}
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-gray-400 mb-2">Drag your file(s) or browse</p>
                    <p className="text-xs text-gray-500">Max 1 MB files are allowed</p>
                    <button 
                      type="button" 
                      className="mt-4 text-blue-500 hover:text-blue-400"
                      onClick={handleBrowse}
                    >
                      Select file
                    </button>
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-white">
                Anything Else?
              </label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Add info or link..."
                rows={3}
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-gray-800 my-6" />

          <button
            type="submit"
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md transition"
          >
            Create Profile
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default JobApplicationModal;