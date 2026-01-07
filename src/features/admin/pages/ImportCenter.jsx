'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { createUser } from '@/features/authentication/services/authService';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import {
    HiMenu,
    HiUpload,
    HiDocumentDownload,
    HiCheckCircle,
    HiExclamationCircle,
    HiInformationCircle,
    HiChevronDown,
    HiChevronUp,
    HiTable
} from 'react-icons/hi';

const ImportCenterPage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFile, setActiveFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    // Data State
    const [analysis, setAnalysis] = useState({
        referees: [],
        evaluators: [],
        schedule: [],
        summary: []
    });

    // Review State
    const [expandedSection, setExpandedSection] = useState(null);

    const [validationErrors, setValidationErrors] = useState([]);
    const [importResults, setImportResults] = useState(null);

    const fileInputRef = useRef(null);

    // --- 1. Template Generation ---
    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();

        // Referees Sheet
        const wsReferees = XLSX.utils.json_to_sheet([
            { Name: "John Doe", Email: "john.doe@example.com", Tier: "Tier 100" },
            { Name: "Jane Smith", Email: "jane.smith@example.com", Tier: "Tier 200" }
        ]);
        XLSX.utils.book_append_sheet(wb, wsReferees, "Referees");

        // Evaluators Sheet
        const wsEvaluators = XLSX.utils.json_to_sheet([
            { Name: "Coach Mike", Email: "mike.coach@example.com" }
        ]);
        XLSX.utils.book_append_sheet(wb, wsEvaluators, "Evaluators");

        // Schedule Sheet
        const wsSchedule = XLSX.utils.json_to_sheet([
            {
                Date: "2024-01-20",
                Time: "14:00",
                Location: "Main Gym",
                Evaluator: "Coach Mike",
                Referees: "John Doe, Jane Smith"
            }
        ]);
        XLSX.utils.book_append_sheet(wb, wsSchedule, "Schedule");

        XLSX.writeFile(wb, "NTBOA_Import_Template.xlsx");
    };

    // --- 2. File Handling ---
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    };

    const processFile = async (file) => {
        setActiveFile(file);
        setIsProcessing(true);
        setValidationErrors([]);
        setAnalysis({ referees: [], evaluators: [], schedule: [], summary: [] });
        setImportResults(null);
        setExpandedSection(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target.result;
                const wb = XLSX.read(data, { type: 'binary' });

                let foundReferees = [];
                let foundEvaluators = [];
                let foundSchedule = [];
                const summary = [];

                wb.SheetNames.forEach(sheetName => {
                    const ws = wb.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
                    if (jsonData.length === 0) return;

                    const cols = Object.keys(jsonData[0]).map(k => k.toLowerCase().trim());
                    const sn = sheetName.toLowerCase().trim();

                    if (sn.includes('referee') || (cols.includes('name') && cols.includes('email') && cols.includes('tier'))) {
                        foundReferees = [...foundReferees, ...jsonData];
                        summary.push(`Found ${jsonData.length} Referees in '${sheetName}'`);
                    }
                    else if (sn.includes('evaluator') || (cols.includes('name') && cols.includes('email') && !cols.includes('tier'))) {
                        foundEvaluators = [...foundEvaluators, ...jsonData];
                        summary.push(`Found ${jsonData.length} Evaluators in '${sheetName}'`);
                    }
                    else if (sn.includes('schedule') || (cols.includes('date') && cols.includes('location') && (cols.includes('evaluator') || cols.includes('referees')))) {
                        foundSchedule = [...foundSchedule, ...jsonData];
                        summary.push(`Found ${jsonData.length} Assignments in '${sheetName}'`);
                    }
                });

                // Fallback single sheet detection
                if (!foundReferees.length && !foundEvaluators.length && !foundSchedule.length && wb.SheetNames.length === 1) {
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
                    const cols = Object.keys(jsonData[0] || {}).map(k => k.toLowerCase().trim());

                    if (cols.includes('date') && cols.includes('location')) {
                        foundSchedule = jsonData;
                        summary.push(`Detected Schedule data`);
                    } else if (cols.includes('tier')) {
                        foundReferees = jsonData;
                        summary.push(`Detected Referee data`);
                    } else if (cols.includes('email')) {
                        foundEvaluators = jsonData;
                        summary.push(`Detected Evaluator data`);
                    }
                }

                setAnalysis({ referees: foundReferees, evaluators: foundEvaluators, schedule: foundSchedule, summary });

                if (!foundReferees.length && !foundEvaluators.length && !foundSchedule.length) {
                    setValidationErrors(["Could not detect valid data. Please check column headers against the guide."]);
                }

            } catch (error) {
                console.error("Parse error:", error);
                setValidationErrors([`Failed to parse file: ${error.message}`]);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- 3. Import Logic (CRITICAL FIXES) ---
    const generateRandomPassword = () => Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

    const handleImport = async () => {
        setIsImporting(true);
        const results = {
            referees: { success: 0, failed: 0, errors: [] },
            evaluators: { success: 0, failed: 0, errors: [] },
            schedule: { success: 0, failed: 0, errors: [] }
        };

        // 1. Pre-fetch existing users to minimize reads
        const existingMap = { evaluators: {}, referees: {} };
        try {
            const [evals, refs] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'evaluator'))),
                getDocs(query(collection(db, 'users'), where('role', '==', 'referee')))
            ]);
            evals.forEach(d => {
                const data = d.data();
                if (data.email) existingMap.evaluators[data.email.toLowerCase()] = d.id;
                if (data.displayName) existingMap.evaluators[data.displayName.toLowerCase()] = d.id;
            });
            refs.forEach(d => {
                const data = d.data();
                if (data.email) existingMap.referees[data.email.toLowerCase()] = d.id;
                if (data.displayName) existingMap.referees[data.displayName.toLowerCase()] = d.id;
            });
        } catch (err) {
            console.error("Failed to load existing users", err);
        }

        // Local Cache for NEWLY created users in this session
        const newUsersMap = { evaluators: {}, referees: {} };

        const importUsers = async (list, role, resultKey) => {
            for (const row of list) {
                const norm = {};
                Object.keys(row).forEach(k => norm[k.toLowerCase().trim()] = row[k]);

                const name = norm['name'];
                const email = norm['email'];
                const tier = norm['tier'] || '';

                if (!name || !email) {
                    results[resultKey].failed++;
                    continue;
                }

                // Check if already exists in DB
                const existingId = existingMap[resultKey][email.toLowerCase()] || existingMap[resultKey][name.toLowerCase()];
                if (existingId) {
                    results[resultKey].success++; // Count as success (already exists)
                    continue;
                }

                try {
                    // 1. Create Auth User
                    const userCred = await createUser(email, generateRandomPassword(), name, role);
                    const uid = userCred.user.uid;

                    // 2. Create Firestore Profile (CRITICAL FIX)
                    await setDoc(doc(db, 'users', uid), {
                        uid,
                        displayName: name,
                        email: email,
                        role: role,
                        tier: role === 'referee' ? tier : null,
                        createdAt: serverTimestamp(),
                        stats: { evaluations: 0, score: 0 } // Initialize stats
                    });

                    // 3. Update Local Map immediately
                    newUsersMap[resultKey][email.toLowerCase()] = uid;
                    newUsersMap[resultKey][name.toLowerCase()] = uid;

                    results[resultKey].success++;
                } catch (err) {
                    if (err.code === 'auth/email-already-in-use') {
                        // Should have been caught by existingMap check ideally, but if not, fetch it?
                        // We skip for now or try to recover ID if we really need it.
                        const q = query(collection(db, 'users'), where('email', '==', email));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const uid = snap.docs[0].id;
                            newUsersMap[resultKey][email.toLowerCase()] = uid;
                        }
                        results[resultKey].success++;
                    } else {
                        results[resultKey].failed++;
                        results[resultKey].errors.push(`Failed ${email}: ${err.message}`);
                    }
                }
            }
        };

        await importUsers(analysis.referees, 'referee', 'referees');
        await importUsers(analysis.evaluators, 'evaluator', 'evaluators');

        // 3. Import Schedule
        if (analysis.schedule.length > 0) {
            for (const row of analysis.schedule) {
                const norm = {};
                Object.keys(row).forEach(k => norm[k.toLowerCase().trim()] = row[k]);

                const dateStr = norm['date'];
                const timeStr = norm['time'];
                const location = norm['location'];
                const evalName = norm['evaluator'];

                let refNames = [];
                if (norm['referees']) refNames = norm['referees'].toString().split(',').map(s => s.trim());

                if (!dateStr || !timeStr || !evalName) {
                    results.schedule.failed++;
                    results.schedule.errors.push(`Missing fields: ${JSON.stringify(row)}`);
                    continue;
                }

                // LINKING LOGIC: Check NEW map first, then EXISTING map
                const evalId = newUsersMap.evaluators[evalName.toLowerCase()] || existingMap.evaluators[evalName.toLowerCase()];

                if (!evalId) {
                    results.schedule.failed++;
                    results.schedule.errors.push(`Evaluator not found: ${evalName}`);
                    continue;
                }

                const refIds = [];
                const missingRefs = [];
                refNames.forEach(rName => {
                    if (!rName) return;
                    const rKey = rName.toLowerCase();
                    const rId = newUsersMap.referees[rKey] || existingMap.referees[rKey];
                    if (rId) refIds.push(rId);
                    else missingRefs.push(rName);
                });

                if (missingRefs.length > 0) {
                    results.schedule.failed++;
                    results.schedule.errors.push(`Referees not found: ${missingRefs.join(', ')}`);
                    continue;
                }

                try {
                    // Formatting Date
                    const d = new Date(`${dateStr} ${timeStr}`);
                    if (isNaN(d.getTime())) throw new Error("Invalid Date");

                    await addDoc(collection(db, 'assignments'), {
                        evaluatorId: evalId,
                        refereeIds: refIds,
                        location,
                        scheduledDate: d,
                        status: 'pending',
                        createdAt: serverTimestamp()
                    });
                    results.schedule.success++;
                } catch (err) {
                    results.schedule.failed++;
                    results.schedule.errors.push(`Error: ${err.message}`);
                }
            }
        }

        setImportResults(results);
        setIsImporting(false);
    };

    return (
        <div className='min-h-screen bg-gradient-primary flex overflow-x-hidden'>
            <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
                <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4'>
                    <BackButton variant='solid' className='shrink-0' />
                    <button onClick={() => setIsSidebarOpen(true)} className='lg:hidden text-white hover:bg-white/10 p-2 rounded-lg'>
                        <HiMenu className='w-6 h-6' />
                    </button>
                    <h1 className='text-fluid-2xl font-bold text-white heading'>Data Import Center</h1>
                </header>

                <div className='p-4 lg:p-8 max-w-6xl mx-auto space-y-8'>

                    {/* Guide Toggle */}
                    <div className='bg-[#2a2a2a] rounded-[20px] border border-[#3a3a3a] overflow-hidden'>
                        <button onClick={() => setShowGuide(!showGuide)} className='w-full flex items-center justify-between p-6 hover:bg-[#333] transition-colors'>
                            <div className='flex items-center gap-3 font-semibold text-white'><HiInformationCircle className='text-accent w-6 h-6' /> Import Guide</div>
                            {showGuide ? <HiChevronUp className='text-white' /> : <HiChevronDown className='text-white' />}
                        </button>
                        {showGuide && (
                            <div className='p-6 border-t border-[#3a3a3a] grid md:grid-cols-2 gap-6'>
                                <div className='text-sm text-[#9ca3af] space-y-2'>
                                    <p>Create a single Excel file with these sheets:</p>
                                    <ul className='list-disc list-inside space-y-1 ml-2'>
                                        <li><span className='text-blue-400'>Referees</span>: Name, Email</li>
                                        <li><span className='text-green-400'>Evaluators</span>: Name, Email</li>
                                        <li><span className='text-orange-400'>Schedule</span>: Date (YYYY-MM-DD), Time (HH:MM), Location, Evaluator, Referees (comma separated names)</li>
                                    </ul>
                                </div>
                                <div className='flex justify-center items-center'>
                                    <button onClick={downloadTemplate} className='flex gap-2 items-center bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white px-4 py-2 rounded-lg border border-[#4a4a4a] transition-all font-medium text-sm'>
                                        <HiDocumentDownload className='w-5 h-5' /> Download Template
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upload Area */}
                    {!analysis.summary.length && !importResults && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className='border-2 border-dashed border-[#4a4a4a] hover:border-accent hover:bg-accent/5 rounded-[20px] p-12 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#2a2a2a]'
                        >
                            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                            {isProcessing ? <div className='animate-spin w-10 h-10 border-2 border-white border-t-transparent rounded-full mb-4' /> : <HiUpload className='w-12 h-12 text-white mb-4' />}
                            <h3 className='text-xl font-bold text-white'>{isProcessing ? 'Analyzing...' : 'Click or Drag & Drop File'}</h3>
                        </div>
                    )}

                    {/* Error Message */}
                    {validationErrors.length > 0 && (
                        <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 flex gap-3 items-start'>
                            <HiExclamationCircle className='w-6 h-6 shrink-0' />
                            <div>{validationErrors.map((e, i) => <div key={i}>{e}</div>)}</div>
                        </div>
                    )}

                    {/* Review & Confirm */}
                    {analysis.summary.length > 0 && !importResults && (
                        <div className='space-y-6 animate-in slide-in-from-bottom-4'>
                            <div className='flex items-center justify-between'>
                                <h2 className='text-2xl font-bold text-white'>Review Data</h2>
                                <button onClick={() => { setAnalysis({ referees: [], evaluators: [], schedule: [], summary: [] }); setActiveFile(null); }} className='text-[#9ca3af] hover:text-white text-sm'>Cancel</button>
                            </div>

                            {/* Referees Table */}
                            {analysis.referees.length > 0 && (
                                <div className='bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] overflow-hidden'>
                                    <button onClick={() => setExpandedSection(expandedSection === 'ref' ? null : 'ref')} className='w-full p-4 flex justify-between items-center hover:bg-[#333]'>
                                        <div className='flex gap-3 items-center'>
                                            <div className='bg-blue-500/20 w-8 h-8 rounded-full flex items-center justify-center text-blue-400 font-bold'>{analysis.referees.length}</div>
                                            <span className='font-bold text-white'>Referees to Create</span>
                                        </div>
                                        <HiTable className='text-[#9ca3af]' />
                                    </button>
                                    {expandedSection === 'ref' && (
                                        <div className='max-h-60 overflow-y-auto border-t border-[#3a3a3a]'>
                                            <table className='w-full text-left text-sm text-[#d1d5db]'>
                                                <thead className='bg-[#1a1a1a] text-[#9ca3af] sticky top-0'>
                                                    <tr><th className='p-3'>Name</th><th className='p-3'>Email</th><th className='p-3'>Tier</th></tr>
                                                </thead>
                                                <tbody className='divide-y divide-[#3a3a3a]'>
                                                    {analysis.referees.map((r, i) => (
                                                        <tr key={i} className='hover:bg-[#333]'>
                                                            <td className='p-3'>{r.name || r.Name}</td>
                                                            <td className='p-3'>{r.email || r.Email}</td>
                                                            <td className='p-3'>{r.tier || r.Tier}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Evaluators Table */}
                            {analysis.evaluators.length > 0 && (
                                <div className='bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] overflow-hidden'>
                                    <button onClick={() => setExpandedSection(expandedSection === 'eval' ? null : 'eval')} className='w-full p-4 flex justify-between items-center hover:bg-[#333]'>
                                        <div className='flex gap-3 items-center'>
                                            <div className='bg-green-500/20 w-8 h-8 rounded-full flex items-center justify-center text-green-400 font-bold'>{analysis.evaluators.length}</div>
                                            <span className='font-bold text-white'>Evaluators to Create</span>
                                        </div>
                                        <HiTable className='text-[#9ca3af]' />
                                    </button>
                                    {expandedSection === 'eval' && (
                                        <div className='max-h-60 overflow-y-auto border-t border-[#3a3a3a]'>
                                            <table className='w-full text-left text-sm text-[#d1d5db]'>
                                                <thead className='bg-[#1a1a1a] text-[#9ca3af] sticky top-0'>
                                                    <tr><th className='p-3'>Name</th><th className='p-3'>Email</th></tr>
                                                </thead>
                                                <tbody className='divide-y divide-[#3a3a3a]'>
                                                    {analysis.evaluators.map((r, i) => (
                                                        <tr key={i} className='hover:bg-[#333]'>
                                                            <td className='p-3'>{r.name || r.Name}</td>
                                                            <td className='p-3'>{r.email || r.Email}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Schedule Table */}
                            {analysis.schedule.length > 0 && (
                                <div className='bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] overflow-hidden'>
                                    <button onClick={() => setExpandedSection(expandedSection === 'sched' ? null : 'sched')} className='w-full p-4 flex justify-between items-center hover:bg-[#333]'>
                                        <div className='flex gap-3 items-center'>
                                            <div className='bg-orange-500/20 w-8 h-8 rounded-full flex items-center justify-center text-orange-400 font-bold'>{analysis.schedule.length}</div>
                                            <span className='font-bold text-white'>Assignments to Create</span>
                                        </div>
                                        <HiTable className='text-[#9ca3af]' />
                                    </button>
                                    {expandedSection === 'sched' && (
                                        <div className='max-h-60 overflow-y-auto border-t border-[#3a3a3a]'>
                                            <table className='w-full text-left text-sm text-[#d1d5db]'>
                                                <thead className='bg-[#1a1a1a] text-[#9ca3af] sticky top-0'>
                                                    <tr><th className='p-3'>Date</th><th className='p-3'>Time</th><th className='p-3'>Evaluator</th><th className='p-3'>Referees</th></tr>
                                                </thead>
                                                <tbody className='divide-y divide-[#3a3a3a]'>
                                                    {analysis.schedule.map((r, i) => (
                                                        <tr key={i} className='hover:bg-[#333]'>
                                                            <td className='p-3'>{r.date || r.Date}</td>
                                                            <td className='p-3'>{r.time || r.Time}</td>
                                                            <td className='p-3 text-green-400'>{r.evaluator || r.Evaluator}</td>
                                                            <td className='p-3 text-blue-400'>{r.referees || r.Referees}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleImport}
                                disabled={isImporting}
                                className='w-full bg-accent hover:bg-accent-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50'
                            >
                                {isImporting ? <div className='animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent' /> : <HiCheckCircle className='w-6 h-6' />}
                                {isImporting ? 'Processing Import...' : 'Confirm & Import All'}
                            </button>
                        </div>
                    )}

                    {/* Results */}
                    {importResults && (
                        <div className='bg-[#2a2a2a] rounded-[20px] p-8 border border-[#3a3a3a] animate-in zoom-in-95 space-y-6'>
                            <div className='text-center space-y-2'>
                                <div className='w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto'>
                                    <HiCheckCircle className='w-10 h-10 text-green-500' />
                                </div>
                                <h2 className='text-2xl font-bold text-white'>Import Completed</h2>
                            </div>

                            <div className='grid md:grid-cols-3 gap-4'>
                                <div className='bg-[#1a1a1a] p-4 rounded-xl border border-[#3a3a3a] text-center'>
                                    <p className='text-[#9ca3af] text-sm mb-1'>Referees</p>
                                    <p className='text-xl font-bold text-white'>{importResults.referees.success} / {analysis.referees.length}</p>
                                    {importResults.referees.failed > 0 && <p className='text-xs text-red-400 mt-1'>{importResults.referees.failed} Failed</p>}
                                </div>
                                <div className='bg-[#1a1a1a] p-4 rounded-xl border border-[#3a3a3a] text-center'>
                                    <p className='text-[#9ca3af] text-sm mb-1'>Evaluators</p>
                                    <p className='text-xl font-bold text-white'>{importResults.evaluators.success} / {analysis.evaluators.length}</p>
                                    {importResults.evaluators.failed > 0 && <p className='text-xs text-red-400 mt-1'>{importResults.evaluators.failed} Failed</p>}
                                </div>
                                <div className='bg-[#1a1a1a] p-4 rounded-xl border border-[#3a3a3a] text-center'>
                                    <p className='text-[#9ca3af] text-sm mb-1'>Assignments</p>
                                    <p className='text-xl font-bold text-white'>{importResults.schedule.success} / {analysis.schedule.length}</p>
                                    {importResults.schedule.failed > 0 && <p className='text-xs text-red-400 mt-1'>{importResults.schedule.failed} Failed</p>}
                                </div>
                            </div>

                            {(importResults.referees.errors.length > 0 || importResults.evaluators.errors.length > 0 || importResults.schedule.errors.length > 0) && (
                                <div className='bg-red-900/10 border border-red-900/30 rounded-xl p-4 max-h-40 overflow-y-auto text-xs text-red-400 space-y-1'>
                                    <p className='font-bold mb-2'>Error Log:</p>
                                    {[...importResults.referees.errors, ...importResults.evaluators.errors, ...importResults.schedule.errors].map((e, i) => (
                                        <div key={i}>{e}</div>
                                    ))}
                                </div>
                            )}

                            <button onClick={() => window.location.reload()} className='w-full bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white py-3 rounded-xl transition-all'>
                                Start New Import
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ImportCenterPage;
