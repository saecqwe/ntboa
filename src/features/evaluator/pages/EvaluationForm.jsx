'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IoMic, IoArrowBack, IoPeople } from 'react-icons/io5';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useAuth } from '@/features/authentication/hooks/useAuth';

export const dynamic = 'force-dynamic';

const CATEGORY_LIST = [
  { id: 'positioning', name: 'Positioning & Court Coverage' },
  { id: 'gameManagement', name: 'Game Management & Control' },
  { id: 'rulesKnowledge', name: 'Rules Knowledge & Application' },
  { id: 'mechanics', name: 'Mechanics & Signals' },
  { id: 'consistency', name: 'Consistency & Accuracy' },
  { id: 'demeanor', name: 'Professional Demeanor' },
  { id: 'decisionSpeed', name: 'Decision Making Speed' },
  { id: 'collaboration', name: 'Team Collaboration' },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

const EvaluationFormContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const officialsParam = searchParams.get('officials');
  const isGroupParam = searchParams.get('isGroup') === 'true';
  const location = searchParams.get('location');

  const officials = officialsParam
    ? JSON.parse(decodeURIComponent(officialsParam))
    : [];

  const [activeTab, setActiveTab] = useState(0);
  const [isGroupEvaluation] = useState(isGroupParam);

  // Calculate total tabs (officials + group evaluation if enabled)
  const totalTabs = isGroupEvaluation ? officials.length + 1 : officials.length;
  const isGroupTab = activeTab === officials.length;

  // State for ratings and comments (per official)
  const [ratings, setRatings] = useState(() => {
    const initialRatings = searchParams.get('initialRatings');
    if (initialRatings) {
      try {
        const parsed = JSON.parse(initialRatings);
        return { 'official_0': parsed };
      } catch (e) {
        console.error('Error parsing initial ratings:', e);
        return {};
      }
    }
    return {};
  });

  const [comments, setComments] = useState(() => {
    const initialComments = searchParams.get('initialComments');
    if (initialComments) {
      try {
        const parsed = JSON.parse(initialComments);
        return { 'official_0': parsed };
      } catch (e) {
        console.error('Error parsing initial comments:', e);
        return {};
      }
    }
    return {};
  });
  const [activeComment, setActiveComment] = useState(null);
  const [isRecording, setIsRecording] = useState({});
  const [recordingStatus, setRecordingStatus] = useState({});
  const [activeRecordingId, setActiveRecordingId] = useState(null);

  // Group evaluation state
  const [groupComment, setGroupComment] = useState('');
  const [isGroupRecording, setIsGroupRecording] = useState(false);
  const [groupRecordingStatus, setGroupRecordingStatus] = useState('');

  // Helper functions to get current tab data
  const getCurrentTabKey = () =>
    isGroupTab ? 'group' : `official_${activeTab}`;
  const getCurrentRatings = () =>
    isGroupTab ? {} : ratings[getCurrentTabKey()] || {};
  const getCurrentComments = () =>
    isGroupTab ? {} : comments[getCurrentTabKey()] || {};

  // Ref to store recognition instances
  const recognitionRef = useRef({});

  // Cleanup recognition instances on unmount
  useEffect(() => {
    return () => {
      Object.values(recognitionRef.current).forEach((recognition) => {
        if (recognition) {
          recognition.stop();
        }
      });
    };
  }, []);

  const handleRatingClick = (categoryId, rating) => {
    if (isGroupTab) return; // No ratings for group evaluation

    const tabKey = getCurrentTabKey();
    setRatings((prev) => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        [categoryId]: rating,
      },
    }));
  };

  const handleCommentChange = (categoryId, value) => {
    if (isGroupTab) return;

    const tabKey = getCurrentTabKey();
    setComments((prev) => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        [categoryId]: value,
      },
    }));
  };

  const startGroupRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        'Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = groupComment || '';

    recognition.onstart = () => {
      setIsGroupRecording(true);
      setGroupRecordingStatus('Listening...');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setGroupComment(finalTranscript + interimTranscript);
    };

    recognition.onerror = () => {
      setGroupRecordingStatus('Error occurred');
      setIsGroupRecording(false);
    };

    recognition.onend = () => {
      setIsGroupRecording(false);
      setGroupRecordingStatus('');
    };

    recognitionRef.current['group'] = recognition;
    recognition.start();
  };

  const stopGroupRecognition = () => {
    if (recognitionRef.current['group']) {
      recognitionRef.current['group'].stop();
      recognitionRef.current['group'] = null;
    }
    setIsGroupRecording(false);
    setGroupRecordingStatus('');
  };

  const startSpeechRecognition = (categoryId) => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        'Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    // Stop any active recording from other categories
    if (activeRecordingId && activeRecordingId !== categoryId) {
      stopSpeechRecognition(activeRecordingId);
    }

    const tabKey = getCurrentTabKey();
    const recognitionKey = `${tabKey}_${categoryId}`;

    // Stop any existing recognition for this category
    if (recognitionRef.current[recognitionKey]) {
      recognitionRef.current[recognitionKey].stop();
      recognitionRef.current[recognitionKey] = null;
    }

    setActiveRecordingId(categoryId);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = getCurrentComments()[categoryId] || '';
    let restartTimeout = null;

    recognition.onstart = () => {
      setIsRecording((prev) => ({
        ...prev,
        [`${tabKey}_${categoryId}`]: true,
      }));
      setRecordingStatus((prev) => ({
        ...prev,
        [`${tabKey}_${categoryId}`]: 'Listening...',
      }));
      setActiveComment(categoryId);
    };

    recognition.onspeechstart = () => {
      setRecordingStatus((prev) => ({
        ...prev,
        [`${tabKey}_${categoryId}`]: 'Speech detected',
      }));
    };

    recognition.onspeechend = () => {
      setRecordingStatus((prev) => ({
        ...prev,
        [categoryId]: 'Processing...',
      }));
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update comments with final transcript or show interim
      const displayText =
        finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');

      setComments((prev) => ({
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          [categoryId]: displayText,
        },
      }));

      // Update status to show we're getting results
      if (
        interimTranscript ||
        event.results[event.results.length - 1].isFinal
      ) {
        setRecordingStatus((prev) => ({
          ...prev,
          [`${tabKey}_${categoryId}`]: 'Transcribing...',
        }));
      }
    };

    recognition.onerror = (event) => {
      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }

      // Handle specific error types
      if (
        event.error === 'not-allowed' ||
        event.error === 'permission-denied'
      ) {
        setIsRecording((prev) => ({
          ...prev,
          [`${tabKey}_${categoryId}`]: false,
        }));
        setActiveRecordingId(null);
        alert(
          'Microphone access denied. Please allow microphone access to use speech-to-text.'
        );
        recognitionRef.current[recognitionKey] = null;
      } else if (event.error === 'no-speech') {
        // No speech detected - try to restart automatically
        restartTimeout = setTimeout(() => {
          if (recognitionRef.current[recognitionKey] === recognition) {
            try {
              recognition.start();
            } catch (e) {
              setIsRecording((prev) => ({
                ...prev,
                [`${tabKey}_${categoryId}`]: false,
              }));
              setActiveRecordingId(null);
            }
          }
        }, 100);
      } else if (event.error === 'aborted') {
        // Recognition was aborted - user stopped it
        setIsRecording((prev) => ({
          ...prev,
          [`${tabKey}_${categoryId}`]: false,
        }));
        setActiveRecordingId(null);
        recognitionRef.current[recognitionKey] = null;
      } else if (event.error === 'audio-capture') {
        setIsRecording((prev) => ({
          ...prev,
          [`${tabKey}_${categoryId}`]: false,
        }));
        setActiveRecordingId(null);
        alert(
          'No microphone found. Please check:\n' +
            '1. Your microphone is connected\n' +
            '2. Browser has permission to access it\n' +
            '3. No other app is using the microphone'
        );
        recognitionRef.current[recognitionKey] = null;
      } else if (event.error === 'network') {
        setIsRecording((prev) => ({
          ...prev,
          [`${tabKey}_${categoryId}`]: false,
        }));
        setActiveRecordingId(null);
        alert('Network error occurred. Please check your internet connection.');
        recognitionRef.current[recognitionKey] = null;
      }
    };

    recognition.onend = () => {
      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }

      // Check if we should restart (user didn't manually stop)
      if (recognitionRef.current[recognitionKey] === recognition) {
        // Try to restart if still active
        restartTimeout = setTimeout(() => {
          if (recognitionRef.current[recognitionKey] === recognition) {
            try {
              recognition.start();
            } catch (e) {
              setIsRecording((prev) => ({
                ...prev,
                [`${tabKey}_${categoryId}`]: false,
              }));
              setActiveRecordingId(null);
              recognitionRef.current[categoryId] = null;
            }
          }
        }, 100);
      } else {
        setIsRecording((prev) => ({ ...prev, [categoryId]: false }));
        setActiveRecordingId(null);
      }
    };

    recognitionRef.current[recognitionKey] = recognition;

    try {
      recognition.start();
    } catch (error) {
      setIsRecording((prev) => ({
        ...prev,
        [`${tabKey}_${categoryId}`]: false,
      }));
      setActiveRecordingId(null);
      alert('Failed to start speech recognition. Please try again.');
    }
  };

  const stopSpeechRecognition = (categoryId) => {
    const tabKey = getCurrentTabKey();
    const recognitionKey = `${tabKey}_${categoryId}`;

    if (recognitionRef.current[recognitionKey]) {
      const recognition = recognitionRef.current[recognitionKey];
      recognitionRef.current[recognitionKey] = null; // Clear ref first to prevent restart
      recognition.stop();
      setIsRecording((prev) => ({ ...prev, [recognitionKey]: false }));
      setRecordingStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[recognitionKey];
        return newStatus;
      });
      setActiveRecordingId(null);
    }
  };

  const handleMicClick = (categoryId) => {
    if (isGroupTab) return; // No mic for group evaluation individual categories

    const tabKey = getCurrentTabKey();
    const recognitionKey = `${tabKey}_${categoryId}`;

    if (isRecording[recognitionKey]) {
      stopSpeechRecognition(categoryId);
    } else {
      startSpeechRecognition(categoryId);
    }
  };

  const handleGroupMicClick = () => {
    if (isGroupRecording) {
      stopGroupRecognition();
    } else {
      startGroupRecognition();
    }
  };

  const handleNext = () => {
    if (isGroupTab) {
      alert("Group submission not implemented. Please submit from an official's tab.");
      return;
    }

    const officialData = officials[activeTab];
    if (!officialData) {
      alert('No official selected.');
      return;
    }

    const tabKey = `official_${activeTab}`;
    const officialRatings = ratings[tabKey] || {};
    const officialComments = comments[tabKey] || {};

    const params = new URLSearchParams();
    params.set('official', JSON.stringify(officialData));
    params.set('ratings', JSON.stringify(officialRatings));
    params.set('comments', JSON.stringify(officialComments));
    params.set('gameLocation', location || '');

    router.push(`/evaluator/evaluation-review?${params.toString()}`);
  };

  return (
    <div className='h-screen flex flex-col bg-[#181818] overflow-hidden'>
      {/* Header */}
      <header className='relative py-6 px-6 lg:py-7 lg:px-8 flex items-center justify-center bg-gradient-secondary'>
        {/* Back Button - Absolute positioned */}
        <button
          onClick={() => router.back()}
          className='absolute left-6 lg:left-8 flex items-center justify-center transition-all active:scale-95'
          aria-label='Go back'
        >
          <IoArrowBack className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
        </button>

        {/* Title - Centered */}
        <h1 className='text-[20px] lg:text-[22px] font-semibold text-white heading'>
          Evaluation Form
        </h1>
      </header>

      {/* Tabs Navigation */}
      {(isGroupEvaluation || officials.length > 1) && (
        <div className='bg-[#2a2a2a] border-b border-[#3a3a3a]'>
          <div className='px-6 lg:px-8'>
            <div className='max-w-md mx-auto lg:max-w-6xl'>
              <div className='flex gap-1 overflow-x-auto scrollbar-hide'>
                {officials.map((official, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveTab(index)}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-all ${
                      activeTab === index
                        ? 'text-white border-b-2 border-accent'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    {official.name.split(' ')[0]}{' '}
                    {official.name.split(' ')[1]?.[0]}.
                  </button>
                ))}
                {isGroupEvaluation && (
                  <button
                    onClick={() => setActiveTab(officials.length)}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-all flex items-center gap-2 ${
                      isGroupTab
                        ? 'text-white border-b-2 border-accent'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    <IoPeople className='w-4 h-4' />
                    Group
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Black Background with Scroll */}
      <div className='flex-1 bg-[#181818] overflow-y-auto overflow-x-hidden'>
        <div className='px-6 pt-6 pb-10 lg:px-8 lg:pt-8 lg:pb-12'>
          <div className='max-w-md mx-auto lg:max-w-6xl'>
            {/* Selected Official Card - Only show if not group tab or single official */}
            {!isGroupTab && (
              <div className='mb-6 lg:mb-8'>
                <div className='bg-white rounded-[15px] px-5 py-4 lg:px-6 lg:py-5 flex items-center justify-between shadow-sm'>
                  {/* Official Name */}
                  <div className='text-[18px] lg:text-[19px] font-semibold text-[#181818] text-body'>
                    {officials[activeTab]?.name}
                  </div>

                  {/* Tier Badge */}
                  <div className='bg-[#e8f4f8] text-[#4a9ab8] text-[14px] lg:text-[15px] font-semibold px-5 py-2 rounded-full text-body whitespace-nowrap'>
                    {officials[activeTab]?.tier}
                  </div>
                </div>
              </div>
            )}

            {/* Group Evaluation Interface */}
            {isGroupTab ? (
              <div className='space-y-6'>
                {/* Group Header */}
                <div className='bg-white rounded-[15px] px-5 py-4 lg:px-6 lg:py-5 shadow-sm'>
                  <div className='flex items-center gap-3 mb-2'>
                    <IoPeople className='w-5 h-5 text-[#4a9ab8]' />
                    <div className='text-[18px] lg:text-[19px] font-semibold text-[#181818] text-body'>
                      Group Evaluation
                    </div>
                  </div>
                  <div className='text-[14px] text-[#666] text-body'>
                    Evaluating:{' '}
                    {officials.map((o) => o.name.split(' ')[0]).join(', ')}
                  </div>
                </div>

                {/* Group Comment Section */}
                <div className='bg-[#2a2a2a] rounded-[20px] p-5 lg:p-6 border border-[#3a3a3a]'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-[16px] lg:text-[17px] font-normal text-white text-body'>
                      Overall Group Comments
                    </h3>
                    <button
                      onClick={handleGroupMicClick}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isGroupRecording
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-accent hover:bg-accent/90'
                      }`}
                      title={
                        isGroupRecording ? 'Stop recording' : 'Start recording'
                      }
                    >
                      <IoMic className='w-5 h-5 text-white' />
                      {isGroupRecording && (
                        <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping' />
                      )}
                    </button>
                  </div>

                  {/* Recording Status */}
                  {groupRecordingStatus && (
                    <div className='mb-3 flex items-center gap-2'>
                      <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
                      <span className='text-[13px] text-gray-400'>
                        {groupRecordingStatus}
                      </span>
                    </div>
                  )}

                  {/* Comment Text Area */}
                  <textarea
                    value={groupComment}
                    onChange={(e) => setGroupComment(e.target.value)}
                    placeholder='Add overall comments about the group performance...'
                    className='w-full bg-[#1a1a1a] text-white placeholder-[#6b7280] rounded-[10px] px-3.5 py-2.5 text-[13px] lg:text-[14px] text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] resize-none'
                    rows={6}
                  />
                </div>
              </div>
            ) : (
              <div>
                {/* Evaluation Categories */}
                <div className='space-y-4 lg:space-y-4'>
                  {CATEGORY_LIST.map((category) => (
                    <div
                      key={category.id}
                      className='bg-[#2a2a2a] rounded-[20px] p-5 lg:p-5 border border-[#3a3a3a]'
                    >
                      {/* Category Name */}
                      <h3 className='text-[16px] lg:text-[17px] font-normal text-white text-body mb-4'>
                        {category.name}
                      </h3>

                      {/* Rating Buttons and Mic */}
                      <div className='flex items-center justify-between gap-3'>
                        {/* Rating Buttons */}
                        <div className='flex gap-1 lg:gap-3'>
                          {RATING_OPTIONS.map((rating) => (
                            <button
                              key={rating}
                              onClick={() =>
                                handleRatingClick(category.id, rating)
                              }
                              className={`w-11 h-11 lg:w-12 lg:h-12 rounded-full border-2 flex items-center justify-center text-[15px] lg:text-[16px] font-normal transition-all ${
                                getCurrentRatings()[category.id] === rating
                                  ? 'bg-accent border-accent text-white'
                                  : 'bg-transparent border-[#4a4a4a] text-white hover:border-[#6a6a6a]'
                              }`}
                            >
                              {rating}
                            </button>
                          ))}
                        </div>

                        {/* Microphone Button */}
                        <button
                          onClick={() => handleMicClick(category.id)}
                          className={`w-8 h-8 lg:w-12 lg:h-12 rounded-full flex items-center justify-center transition-all shrink-0 relative ${
                            isRecording[`${getCurrentTabKey()}_${category.id}`]
                              ? 'bg-red-600 animate-pulse'
                              : activeComment === category.id ||
                                getCurrentComments()[category.id]
                              ? 'bg-accent'
                              : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
                          }`}
                          title={
                            isRecording[`${getCurrentTabKey()}_${category.id}`]
                              ? 'Stop recording'
                              : 'Start recording'
                          }
                        >
                          <IoMic className='w-5 h-5 text-white' />
                          {isRecording[
                            `${getCurrentTabKey()}_${category.id}`
                          ] && (
                            <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping' />
                          )}
                        </button>
                      </div>

                      {/* Recording Status */}
                      {recordingStatus[
                        `${getCurrentTabKey()}_${category.id}`
                      ] && (
                        <div className='mt-3 flex items-center gap-2'>
                          <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
                          <span className='text-[13px] text-gray-400'>
                            {
                              recordingStatus[
                                `${getCurrentTabKey()}_${category.id}`
                              ]
                            }
                          </span>
                        </div>
                      )}

                      {/* Comment Display/Edit Area */}
                      {(activeComment === category.id ||
                        getCurrentComments()[category.id]) && (
                        <div className='mt-4'>
                          {activeComment === category.id ? (
                            <textarea
                              value={getCurrentComments()[category.id] || ''}
                              onChange={(e) =>
                                handleCommentChange(category.id, e.target.value)
                              }
                              placeholder='Add your comment here...'
                              className='w-full bg-[#1a1a1a] text-white placeholder-[#6b7280] rounded-[10px] px-3.5 py-2.5 text-[13px] lg:text-[14px] text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] resize-none'
                              rows={2}
                              autoFocus
                            />
                          ) : (
                            <div className='bg-[#1a1a1a] rounded-[10px] px-3.5 py-2.5 border border-[#3a3a3a]'>
                              <div className='text-[13px] lg:text-[14px] text-[#9ca3af] text-body leading-relaxed'>
                                {getCurrentComments()[category.id]}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Button */}
            <div className='mt-8 lg:mt-10'>
              <button
                onClick={handleNext}
                className='w-full bg-accent hover:opacity-90 rounded-[15px] py-4 lg:py-[18px] text-center transition-all active:scale-[0.98] shadow-lg'
              >
                <div className='text-[18px] lg:text-[19px] font-bold text-white heading'>
                  Submit Evaluation
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EvaluationFormPage() {
  return (
    <Suspense
      fallback={
        <div className='p-8 text-white'>Loading evaluation form...</div>
      }
    >
      <EvaluationFormContent />
    </Suspense>
  );
}
