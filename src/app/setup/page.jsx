'use client';

import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';
import toast, { Toaster } from 'react-hot-toast';

const SetupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const createAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create Firestore Profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: 'Admin User',
        role: 'admin',
        createdAt: serverTimestamp(),
      });

      toast.success('Admin user created successfully!');
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedDatabase = async () => {
    setLoading(true);
    const toastId = toast.loading('Seeding database...');
    try {
      // 1. Create Dummy Referees
      const referees = [
        { name: 'Michael Jordan', tier: 'Tier 1' },
        { name: 'LeBron James', tier: 'Tier 2' },
        { name: 'Kobe Bryant', tier: 'Tier 1' },
        { name: 'Stephen Curry', tier: 'Tier 3' },
        { name: 'Shaquille O\'Neal', tier: 'Tier 2' },
      ];

      const refereeIds = [];

      for (const ref of referees) {
        // We simulate creating a user for them (just the doc for now to link evaluations)
        // In reality, they would sign up. We'll just create "ghost" users in the collection
        // or actually create auth users if we wanted to be thorough, but let's just create docs.
        // Wait, 'users' collection usually maps to Auth UIDs. 
        // For dashboard to work, we need documents in 'users' with role 'referee'.
        const newRefRef = doc(collection(db, 'referees'));
        await setDoc(newRefRef, {
          uid: newRefRef.id,
          displayName: ref.name,
          email: `${ref.name.replace(' ', '.').toLowerCase()}@example.com`,
          role: 'referee',
          tier: ref.tier,
          createdAt: serverTimestamp(),
          level: 'Unassigned',
          overallScore: 0,
        });
        refereeIds.push(newRefRef.id);
      }

      // 2. Create Dummy Evaluator
      const evaluatorRef = doc(collection(db, 'users'));
      await setDoc(evaluatorRef, {
        uid: evaluatorRef.id,
        displayName: 'John Evaluator',
        email: 'evaluator@example.com',
        role: 'evaluator',
        createdAt: serverTimestamp(),
      });

      // 3. Create Dummy Evaluations
      for (let i = 0; i < 10; i++) {
        const randomRefereeId = refereeIds[Math.floor(Math.random() * refereeIds.length)];
        await addDoc(collection(db, 'evaluations'), {
          refereeId: randomRefereeId,
          evaluatorId: evaluatorRef.id,
          totalScore: Math.floor(Math.random() * 20) + 20, // 20-40
          tier: 'Tier ' + Math.ceil(Math.random() * 3),
          createdAt: serverTimestamp(),
          comments: { general: 'Great game management.' },
          scores: { mechanics: 4, positioning: 5 },
          gameDate: new Date().toISOString().split('T')[0],
          location: 'Stadium ' + (i + 1),
        });
      }

      toast.success('Database seeded successfully!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to seed database: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Toaster />
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Admin Setup</h1>
        
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">1. Create Admin User</h2>
          <form onSubmit={createAdmin} className="space-y-4">
            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded text-black bg-white"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded text-black bg-white"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Create Admin'}
            </button>
          </form>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">2. Seed Database</h2>
          <p className="text-sm text-gray-500 mb-4">
            Adds dummy referees, evaluators, and evaluations for testing.
          </p>
          <button
            onClick={seedDatabase}
            disabled={loading}
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Seed Dummy Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
