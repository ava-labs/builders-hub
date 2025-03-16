"use client";

import { useState } from 'react';
import Modal from '../ui/Modal';

interface BountySubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bountyTitle?: string;
}

const BountySubmissionModal: React.FC<BountySubmissionModalProps> = ({
  isOpen,
  onClose,
  bountyTitle = "Bounty"
}) => {
  const [submissionLink, setSubmissionLink] = useState('');
  const [tweetLink, setTweetLink] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionLink) return; // Basic validation

    // Reset form
    setSubmissionLink('');
    setTweetLink('');
    setAdditionalInfo('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${bountyTitle} Submission`}
      description="We can't wait to see what you've created!"
    >
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-white">
                Link to Your Submission
                <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={submissionLink}
                onChange={(e) => setSubmissionLink(e.target.value)}
                placeholder="Add a link"
                required
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-white">
                Tweet Link
              </label>
              <input
                type="url"
                value={tweetLink}
                onChange={(e) => setTweetLink(e.target.value)}
                placeholder="Add a tweet's link"
                className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setIsAdditionalInfoOpen(!isAdditionalInfoOpen)}
              >
                <label className="block text-white cursor-pointer">
                  Anything Else?
                </label>
                <svg 
                  className={`w-5 h-5 text-gray-400 transform ${isAdditionalInfoOpen ? 'rotate-180' : ''} transition-transform`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isAdditionalInfoOpen && (
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="If you have any other links or information you'd like to share with us, please add them here!"
                  rows={4}
                  className="w-full bg-black border border-gray-700 rounded-md p-3 text-white placeholder-gray-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          <hr className="border-gray-800 my-6" />

          <button
            type="submit"
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md transition"
          >
            Submit
          </button>
        </form>
      </div>
    </Modal>
  );
};

export { BountySubmissionModal };