'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiX, HiPlus, HiPencil, HiTrash, HiLocationMarker } from 'react-icons/hi';

const LocationsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'locations'));
      const snapshot = await getDocs(q);
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLocations(locs.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (isEditing && currentLocation) {
        await updateDoc(doc(db, 'locations', currentLocation.id), {
          name,
          address
        });
        setLocations(prev => prev.map(l => l.id === currentLocation.id ? { ...l, name, address } : l));
      } else {
        const docRef = await addDoc(collection(db, 'locations'), {
          name,
          address,
          createdAt: new Date().toISOString()
        });
        setLocations(prev => [...prev, { id: docRef.id, name, address }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetForm();
    } catch (error) {
      console.error("Error saving location:", error);
      alert("Failed to save location.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this location?")) return;
    try {
      await deleteDoc(doc(db, 'locations', id));
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error("Error deleting location:", error);
    }
  };

  const handleEdit = (location) => {
    setIsEditing(true);
    setCurrentLocation(location);
    setName(location.name);
    setAddress(location.address || '');
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentLocation(null);
    setName('');
    setAddress('');
  };

  return (
    <div className='min-h-screen bg-gradient-primary flex overflow-x-hidden'>
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4 sticky top-0 z-20'>
          <BackButton variant='solid' className='shrink-0' />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors shrink-0'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-2xl md:text-fluid-3xl font-semibold text-white heading min-w-0 truncate flex-1'>
            Locations
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 sm:p-6 lg:p-8 min-w-0'>
          <div className='max-w-7xl mx-auto space-y-6 w-full'>
            
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              {/* Form Section */}
              <div className='lg:col-span-1'>
                <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[20px] p-6 sticky top-24'>
                  <h2 className='text-xl font-bold text-white mb-4 flex items-center gap-2'>
                    {isEditing ? <HiPencil /> : <HiPlus />}
                    {isEditing ? 'Edit Location' : 'Add New Location'}
                  </h2>
                  <form onSubmit={handleSubmit} className='space-y-4'>
                    <div>
                      <label className='block text-sm text-[#9ca3af] mb-1'>Location Name</label>
                      <input
                        type='text'
                        placeholder='e.g., Coppell Arena'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f97316] outline-none border border-[#3a3a3a]'
                        required
                      />
                    </div>
                    <div>
                      <label className='block text-sm text-[#9ca3af] mb-1'>Address (Optional)</label>
                      <textarea
                        placeholder='e.g., 123 Main St, Dallas, TX'
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f97316] outline-none border border-[#3a3a3a] h-24 resize-none'
                      />
                    </div>
                    
                    <div className='flex gap-2 pt-2'>
                      {isEditing && (
                        <button
                          type='button'
                          onClick={resetForm}
                          className='flex-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white py-3 rounded-xl font-medium transition-colors'
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type='submit'
                        className='flex-1 bg-accent hover:opacity-90 text-white py-3 rounded-xl font-medium transition-all shadow-lg'
                      >
                        {isEditing ? 'Update' : 'Add Location'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* List Section */}
              <div className='lg:col-span-2'>
                <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[20px] p-6'>
                   <h2 className='text-xl font-bold text-white mb-6 flex items-center gap-2'>
                    <HiLocationMarker className='text-[#f97316]' />
                    Managed Locations ({locations.length})
                  </h2>

                  {loading ? (
                    <div className='text-center text-[#9ca3af] py-8'>Loading locations...</div>
                  ) : locations.length === 0 ? (
                    <div className='text-center text-[#9ca3af] py-8 bg-[#2a2a2a] rounded-xl border border-dashed border-[#3a3a3a]'>
                      No locations found. Add one to get started.
                    </div>
                  ) : (
                    <div className='grid gap-3'>
                      {locations.map((loc) => (
                        <div 
                          key={loc.id}
                          className='bg-[#2a2a2a] p-4 rounded-xl border border-[#3a3a3a] flex items-center justify-between group hover:border-[#f97316]/50 transition-colors'
                        >
                          <div>
                            <h3 className='font-semibold text-white text-lg'>{loc.name}</h3>
                            {loc.address && <p className='text-sm text-[#9ca3af] mt-1'>{loc.address}</p>}
                          </div>
                          <div className='flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button
                              onClick={() => handleEdit(loc)}
                              className='p-2 bg-[#3a3a3a] hover:bg-[#f97316] text-white rounded-lg transition-colors'
                              title='Edit'
                            >
                              <HiPencil className='w-4 h-4' />
                            </button>
                            <button
                              onClick={() => handleDelete(loc.id)}
                              className='p-2 bg-[#3a3a3a] hover:bg-[#ef4444] text-white rounded-lg transition-colors'
                              title='Delete'
                            >
                              <HiTrash className='w-4 h-4' />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationsPage;
