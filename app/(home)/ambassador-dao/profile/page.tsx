"use client"

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

// Main ProfilePage component
const AmbasssadorDaoProfilePage = () => {
  const [activeTab, setActiveTab] = useState('Bounties');
  const [activeProjectTab, setActiveProjectTab] = useState('Applied');

  // Mock data for the profile
  const profile = {
    name: 'John Doe',
    username: '@amethyst-76',
    location: 'United States',
    skills: ['Badge', 'Badge', 'Badge'],
    socials: ['Badge', 'Badge', 'Badge'],
    stats: {
      earned: 0,
      submissions: 0,
      bounty: 0
    }
  };

  // Mock data for projects
  const projects = [
    {
      id: 1,
      name: 'Project Name',
      description: 'Lorem ipsum Dolor Sit Amet, Consetetur S...',
      type: 'Job',
      proposals: 60,
      reward: 1000,
      status: 'Reward Pending'
    },
    {
      id: 2,
      name: 'Project Name',
      description: 'Lorem ipsum Dolor Sit Amet, Consetetur S...',
      type: 'Job',
      proposals: 60,
      reward: 1000,
      status: 'Reward Pending'
    },
    {
      id: 3,
      name: 'Project Name',
      description: 'Lorem ipsum Dolor Sit Amet, Consetetur S...',
      type: 'Job',
      proposals: 60,
      reward: 1000,
      status: 'Reward Pending'
    },
    {
      id: 4,
      name: 'Project Name',
      description: 'Lorem ipsum Dolor Sit Amet, Consetetur S...',
      type: 'Job',
      proposals: 60,
      reward: 1000,
      status: 'Reward Pending'
    },
    {
      id: 5,
      name: 'Project Name',
      description: 'Lorem ipsum Dolor Sit Amet, Consetetur S...',
      type: 'Job',
      proposals: 60,
      reward: 1000,
      status: 'Reward Pending'
    }
  ];

  // External links for the footer
  const externalLinks = {
    avalanche: [
      { name: 'Explorer', url: '#' },
      { name: 'Get Started', url: '#' },
      { name: 'GitHub', url: '#' },
      { name: 'Whitepapers', url: '#' },
      { name: 'Statistics', url: '#' }
    ],
    community: [
      { name: 'Facebook', url: '#' },
      { name: 'Discord', url: '#' },
      { name: 'Medium', url: '#' },
      { name: 'Telegram', url: '#' },
      { name: 'Blog', url: '#' },
      { name: 'Forum', url: '#' },
      { name: 'Support', url: '#' },
      { name: 'Youtube', url: '#' },
      { name: 'Twitter', url: '#' },
      { name: 'LinkedIn', url: '#' }
    ],
    moreLinks: [
      { name: 'Enterprise Solutions', url: '#' },
      { name: 'Audits', url: '#' },
      { name: 'Core Wallet', url: '#' },
      { name: 'Legal', url: '#' },
      { name: 'Network Status', url: '#' }
    ]
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Profile header */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-16 h-16 bg-blue-500 rounded-full mr-4 overflow-hidden">
                <img src="/api/placeholder/50/50" alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.name}</h2>
                <p className="text-gray-400">{profile.username}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md">
                Edit Profile
              </button>
              <button className="border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md">
                Share
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-xl font-bold mb-2">Details</h3>
              <p className="text-gray-400">Base in: {profile.location}</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, index) => (
                  <span key={index} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Socials</h3>
              <div className="flex flex-wrap gap-2">
                {profile.socials.map((social, index) => (
                  <span key={index} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {social}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-6 text-center">
            <div>
              <h2 className="text-2xl font-bold">{profile.stats.earned}</h2>
              <p className="text-gray-400">Earned</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile.stats.submissions}</h2>
              <p className="text-gray-400">Submissions</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile.stats.bounty}</h2>
              <p className="text-gray-400">Bounty</p>
            </div>
          </div>
        </div>

        {/* Projects section */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">My Projects</h2>
          
          {/* Tabs for bounties/jobs */}
          <div className="flex mb-4 border-b border-gray-800">
            <button
              className={`px-4 py-2 ${activeTab === 'Bounties' ? 'bg-red-500 text-white' : 'text-gray-400'} rounded-t-md`}
              onClick={() => setActiveTab('Bounties')}
            >
              Bounties
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'Jobs' ? 'bg-gray-800 text-white' : 'text-gray-400'} rounded-t-md`}
              onClick={() => setActiveTab('Jobs')}
            >
              Jobs
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="flex space-x-2 mb-2 md:mb-0">
              <button
                className={`px-4 py-2 rounded-md ${activeProjectTab === 'Applied' ? 'bg-gray-800' : 'bg-transparent'}`}
                onClick={() => setActiveProjectTab('Applied')}
              >
                Applied <span className="ml-1 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">4</span>
              </button>
              <button
                className={`px-4 py-2 rounded-md ${activeProjectTab === 'Won' ? 'bg-gray-800' : 'bg-transparent'}`}
                onClick={() => setActiveProjectTab('Won')}
              >
                Won <span className="ml-1 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">4</span>
              </button>
              <button
                className={`px-4 py-2 rounded-md ${activeProjectTab === 'Closed' ? 'bg-gray-800' : 'bg-transparent'}`}
                onClick={() => setActiveProjectTab('Closed')}
              >
                Closed <span className="ml-1 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">4</span>
              </button>
            </div>
            <div className="flex space-x-2 w-full md:w-auto">
              <select className="bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700">
                <option>Date Applied</option>
              </select>
              <select className="bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700">
                <option>Category</option>
              </select>
              <input
                type="text"
                placeholder="Search..."
                className="bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700"
              />
            </div>
          </div>

          {/* Project list */}
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex flex-col md:flex-row justify-between">
                  <div className="flex">
                    <div className="w-10 h-10 bg-blue-500 rounded-full mr-3 overflow-hidden">
                      <img src="/api/placeholder/40/40" alt="Project" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-red-500 font-bold">{project.name}</h3>
                      <p className="text-gray-400 text-sm">{project.description}</p>
                    </div>
                  </div>
                  <div className="flex mt-4 md:mt-0 items-center space-x-6">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">
                        {project.type}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">
                        {project.proposals} Proposals
                      </p>
                    </div>
                    <div className="text-center flex items-center">
                      <span className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center mr-2">
                        $
                      </span>
                      <span className="text-white">{project.reward} USDC</span>
                    </div>
                    <div>
                      <span className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
                        {project.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Links section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div>
            <h3 className="text-xl font-bold mb-4">Avalanche</h3>
            <ul className="space-y-2">
              {externalLinks.avalanche.map((link, index) => (
                <li key={index}>
                  <a href={link.url} className="text-gray-400 hover:text-white flex items-center">
                    {link.name}
                    <ExternalLink className="ml-2 w-4 h-4 text-blue-400" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Community</h3>
            <div className="grid grid-cols-2 gap-2">
              {externalLinks.community.map((link, index) => (
                <div key={index}>
                  <a href={link.url} className="text-gray-400 hover:text-white flex items-center">
                    {link.name}
                    <ExternalLink className="ml-2 w-4 h-4 text-blue-400" />
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">More Links</h3>
            <ul className="space-y-2">
              {externalLinks.moreLinks.map((link, index) => (
                <li key={index}>
                  <a href={link.url} className="text-gray-400 hover:text-white flex items-center">
                    {link.name}
                    <ExternalLink className="ml-2 w-4 h-4 text-blue-400" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbasssadorDaoProfilePage;