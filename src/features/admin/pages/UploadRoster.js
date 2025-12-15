'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { createUser } from '@/features/authentication/services/authService';
import { HiMenu, HiUpload } from 'react-icons/hi';

const UploadRosterPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, successful: 0, failed: 0 });
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const generateRandomPassword = (length = 12) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const resetState = () => {
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress({ total: 0, successful: 0, failed: 0 });
    setErrors([]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrors([]);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: async (result, parser) => {
        parser.pause();
        setUploadProgress(prev => ({ ...prev, total: prev.total + 1 }));
        const { Name, Email } = result.data;

        if (!Name || !Email) {
          setErrors(prev => [...prev, `Invalid row: ${JSON.stringify(result.data)}`]);
          setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
          parser.resume();
          return;
        }

        try {
          const password = generateRandomPassword();
          await createUser(Email, password, Name, 'referee');
          setUploadProgress(prev => ({ ...prev, successful: prev.successful + 1 }));
        } catch (error) {
          const errorMessage = error.message || 'An unknown error occurred.';
          setErrors(prev => [...prev, `Failed to create ${Email}: ${errorMessage}`]);
          setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        }
        parser.resume();
      },
      complete: () => {
        setIsUploading(false);
        // You might want to show a summary message here
        alert(`Upload complete! Successful: ${uploadProgress.successful}, Failed: ${uploadProgress.failed}`);
      },
      error: (error) => {
        setIsUploading(false);
        alert(`An error occurred during parsing: ${error.message}`);
      }
    });
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        resetState();
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV file');
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        resetState();
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV file');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };


  return (
    <div className='min-h-screen bg-gradient-primary flex overflow-x-hidden'>
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4'>
          <BackButton variant='solid' className='shrink-0' />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors shrink-0'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='sm:text-fluid-2xl md:text-fluid-3xl font-semibold text-white heading min-w-0 truncate'>
            Upload Officials Roster
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 sm:p-6 lg:p-8 min-w-0'>
          <div className='max-w-5xl mx-auto w-full'>
            <div className='bg-[#2a2a2a] rounded-[20px] p-6 sm:p-8 lg:p-12 border border-[#3a3a3a]'>
              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                className={`relative rounded-[20px] p-12 sm:p-16 lg:p-24 border-2 border-dashed transition-all cursor-pointer ${
                  isDragging
                    ? 'border-accent bg-[#3a3a3a]'
                    : 'border-[#5a5a5a] hover:border-[#6a6a6a]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.csv'
                  onChange={handleFileSelect}
                  className='hidden'
                />

                <div className='flex flex-col items-center justify-center text-center space-y-6'>
                  <div className='w-20 h-20 sm:w-24 sm:h-24 bg-accent rounded-full flex items-center justify-center'>
                    <HiUpload className='w-10 h-10 sm:w-12 sm:h-12 text-white' />
                  </div>
                  <div className='space-y-2'>
                    <h2 className='text-fluid-3xl font-bold text-white'>
                      Drag & Drop CSV file here
                    </h2>
                    <p className='text-fluid-lg text-[#9ca3af]'>
                      Or Click to Browse
                    </p>
                  </div>
                  {selectedFile && !isUploading && (
                    <div className='mt-4 px-6 py-3 bg-accent/20 rounded-lg border border-accent/30'>
                      <p className='text-fluid-base text-white font-medium'>
                        Selected: {selectedFile.name}
                      </p>
                    </div>
                  )}
                  {isUploading && (
                     <div className='text-white mt-4'>
                        <p>Processing... {uploadProgress.successful + uploadProgress.failed} / {uploadProgress.total}</p>
                        <p className='text-green-400'>Successful: {uploadProgress.successful}</p>
                        <p className='text-red-400'>Failed: {uploadProgress.failed}</p>
                     </div>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className='mt-6 bg-[#3a3a3a] rounded-[20px] p-6 sm:p-8 border border-[#4a4a4a]'>
                <div className='space-y-2'>
                  <p className='text-fluid-base text-white'>
                    <span className='font-semibold'>Accepted Format:</span>{' '}
                    <span className='text-[#d1d5db]'>CSV file with columns: Name, Email</span>
                  </p>
                  <p className='text-fluid-base text-[#9ca3af]'>
                    Example: John Doe, john.doe@ntboa.org
                  </p>
                </div>
              </div>

              {selectedFile && (
                <div className='mt-6 flex justify-end'>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || (uploadProgress.total > 0 && !isUploading)}
                    className='bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-10 py-4 text-fluid-lg font-semibold text-white transition-all active:scale-[0.98] shadow-lg'
                  >
                    {isUploading ? (
                      <div className='flex items-center gap-3'>
                        <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      'Upload File'
                    )}
                  </button>
                </div>
              )}

              {errors.length > 0 && !isUploading && (
                <div className='mt-6 bg-red-900/50 border border-red-700 rounded-lg p-4'>
                    <h3 className='text-red-300 font-semibold mb-2'>Upload Errors:</h3>
                    <ul className='text-red-400 text-sm space-y-1 max-h-40 overflow-y-auto'>
                        {errors.map((error, i) => <li key={i}>{error}</li>)}
                    </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadRosterPage;

