# NTBOA Codebase Audit: Real Flaws, Hidden Bugs & Fix Checklist

> **Purpose of this document:** This is an internal engineering audit of the NTBOA web application. It identifies real bugs, silent failures, data inconsistencies, security rule conflicts, and performance bottlenecks that will cause user complaints and system breakdowns as the app is used.
>
> Every item includes:
> 1. **The Exact Files & Line Numbers**
> 2. **What Actually Happens (In plain words)**
> 3. **The User Complaint It Will Cause**
> 4. **The Exact Code Fix**

---

## Table of Contents
1. [Critical Bugs & Data Loss Risks (Fix Immediately)](#1-critical-bugs--data-loss-risks-fix-immediately)
   - [Bug 1: URL Parameter Overflow Crashes Evaluation Review & Erases Form Notes](#bug-1-url-parameter-overflow-crashes-evaluation-review--erases-form-notes)
   - [Bug 2: Base64 Photos Stored in Firestore User Documents (Memory Bomb)](#bug-2-base64-photos-stored-in-firestore-user-documents-memory-bomb)
   - [Bug 3: Firestore Rules Silently Block Evaluators from Updating Referee Suggested Tier](#bug-3-firestore-rules-silently-block-evaluators-from-updating-referee-suggested-tier)
   - [Bug 4: Editing Group Evaluations Overwrites Total Score with One Official's Score](#bug-4-editing-group-evaluations-overwrites-total-score-with-one-officials-score)
2. [Data Inconsistency & Broken Stats](#2-data-inconsistency--broken-stats)
   - [Bug 5: Evaluator "# OF EVALUATIONS" Always Shows 0](#bug-5-evaluator--of-evaluations-always-shows-0)
   - [Bug 6: Arbitrary limit(200) Wipes Out Stats for Active Referees](#bug-6-arbitrary-limit200-wipes-out-stats-for-active-referees)
   - [Bug 7: Dashboard Stats & Top Officials Break Past 500 Evaluations](#bug-7-dashboard-stats--top-officials-break-past-500-evaluations)
   - [Bug 8: Inverted Referee Tier Progress Bar (Tier 100 Shows 0% Progress)](#bug-8-inverted-referee-tier-progress-bar-tier-100-shows-0-progress)
   - [Bug 9: Fake Hardcoded "+1.2%" Trend Arrow on Referee Home](#bug-9-fake-hardcoded-12-trend-arrow-on-referee-home)
3. [Excel Import Flaws & Schema Breaking](#3-excel-import-flaws--schema-breaking)
   - [Bug 10: Import Center Creates Incompatible Database Schemas](#bug-10-import-center-creates-incompatible-database-schemas)
   - [Bug 11: Excel Serial Date Numbers Crash Schedule Import with "Invalid Date"](#bug-11-excel-serial-date-numbers-crash-schedule-import-with-invalid-date)
   - [Bug 12: createUser() Arguments Mismatch](#bug-12-createuser-arguments-mismatch)
4. [Session Leaks & Shared Computer Contamination](#4-session-leaks--shared-computer-contamination)
   - [Bug 13: Unscoped localStorage Causes Profile Identity Leaks Between Users](#bug-13-unscoped-localstorage-causes-profile-identity-leaks-between-users)
   - [Bug 14: Hardcoded "John / JS" Fallbacks in Evaluator Pages](#bug-14-hardcoded-john--js-fallbacks-in-evaluator-pages)
5. [Performance & Unbounded Queries](#5-performance--unbounded-queries)
   - [Bug 15: Assignments Page Downloads Every Assignment Ever Created](#bug-15-assignments-page-downloads-every-assignment-ever-created)
   - [Bug 16: Evaluator History Has No Order By and Cuts Off at 50 Items](#bug-16-evaluator-history-has-no-order-by-and-cuts-off-at-50-items)
   - [Bug 17: Downloading Full Users Collection to Map Names](#bug-17-downloading-full-users-collection-to-map-names)
6. [Summary Checklist (Prioritized by Severity)](#6-summary-checklist-prioritized-by-severity)

---

## 1. Critical Bugs & Data Loss Risks (Fix Immediately)

### Bug 1: URL Parameter Overflow Crashes Evaluation Review & Erases Form Notes
- **Files:** 
  - `src/features/evaluator/pages/EvaluationForm.jsx` (Lines 505–518)
  - `src/features/evaluator/pages/EvaluationReview.jsx` (Lines 35–49)
- **What happens:**
  When an evaluator finishes grading officials, `EvaluationForm.jsx` serializes the *entire evaluation*—all officials, all scores, all category text comments, and the group comment—into a single browser URL query string:
  ```javascript
  const params = new URLSearchParams();
  params.set('officials', JSON.stringify(officials));
  params.set('ratings', JSON.stringify(ratings));
  params.set('comments', JSON.stringify(comments));
  router.push(`/evaluator/evaluation-review?${params.toString()}`);
  ```
  In `EvaluationReview.jsx`, it reads them back with `JSON.parse(searchParams.get('comments'))`.
- **The User Complaint:**
  > *"I spent 20 minutes voice-typing detailed feedback for 3 officials across 8 categories. When I tapped Review, the screen went completely white. When I hit back, everything was gone!"*
- **Why it breaks:**
  Browsers and mobile webviews have strict URL length limits (2,000 to 4,000 characters). A detailed 3-referee evaluation easily generates 4,000 to 10,000 characters of JSON. The browser silently truncates the URL query string. When `EvaluationReview.jsx` executes `JSON.parse()`, it throws `SyntaxError: Unexpected end of JSON input`, unmounts the component, and displays a white screen crash.
- **The Fix:**
  Stop passing large form state in URL parameters. Use `sessionStorage` or a React Context:
  ```javascript
  // In EvaluationForm.jsx before navigating:
  sessionStorage.setItem('pending_evaluation', JSON.stringify({
    officials,
    ratings,
    comments,
    isGroup: isGroupEvaluation,
    groupComment,
    location,
  }));
  router.push('/evaluator/evaluation-review');

  // In EvaluationReview.jsx:
  useEffect(() => {
    const raw = sessionStorage.getItem('pending_evaluation');
    if (raw) {
      const data = JSON.parse(raw);
      // set state...
    }
  }, []);
  ```

---

### Bug 2: Base64 Photos Stored in Firestore User Documents (Memory Bomb)
- **Files:**
  - `src/features/referee/pages/Profile.jsx` (Lines 115–120, 147–152)
  - `src/features/admin/pages/Settings.jsx` (Lines 170–175, 99–105)
  - `src/features/authentication/services/authService.js` (Lines 99–106)
- **What happens:**
  When a user uploads a profile picture, the code compresses it to a base64 Data URL string (`data:image/jpeg;base64,...`) and saves that string **directly into the Firestore user document** in the `photo` and `photoURL` fields.
  In `authService.js`, the limit check even allows strings up to **950,000 bytes (~0.95 MB)** per user document:
  ```javascript
  const maxByteLength = 950000;
  if (typeof payload.photo === 'string' && payload.photo.length > maxByteLength) { ... }
  ```
- **The User Complaint:**
  > *"The admin dashboard and assignments page take 15–20 seconds to open, and our phones freeze or run out of memory."*
- **Why it breaks:**
  Multiple admin pages call:
  ```javascript
  getDocs(collection(db, 'users'))
  ```
  If 100 referees and evaluators upload photos averaging 400 KB each, a single dashboard load downloads **40 Megabytes of raw image data** inside JSON payloads just to read their display names! Browser memory spikes, mobile devices choke, and your Firestore network transfer bandwidth explodes.
- **The Fix:**
  Upload images to **Firebase Storage**, obtain an HTTPS download URL, and store only that URL string in Firestore:
  ```javascript
  import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

  const storage = getStorage();
  const fileRef = ref(storage, `profiles/${userId}_${Date.now()}.jpg`);
  await uploadBytes(fileRef, blobFile);
  const downloadUrl = await getDownloadURL(fileRef);

  await updateUserProfile(userId, { photoURL: downloadUrl });
  ```

---

### Bug 3: Firestore Rules Silently Block Evaluators from Updating Referee Suggested Tier
- **Files:**
  - `src/features/evaluator/pages/EvaluationReview.jsx` (Lines 183–193)
  - `firestore.rules` (Lines 38–51)
- **What happens:**
  When an evaluator submits an evaluation, `EvaluationReview.jsx` tries to update the referee's profile document with the new suggested tier:
  ```javascript
  await Promise.all(officials.map(async (off) => {
    if (!off.id) return;
    try {
      const refereeRef = doc(db, 'users', off.id);
      await updateDoc(refereeRef, {
        suggestedTier: `Tier ${currentTier.tier}`,
      });
    } catch (tierError) {
      console.error("Error updating referee suggested tier for official", off.id, tierError);
    }
  }));
  ```
  However, `firestore.rules` line 44 says:
  ```
  allow update: if isAuthenticated() && (
    isAdmin() ||
    (isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status']))
  );
  ```
  An Evaluator is **neither Admin nor the Owner** of the referee's user document.
- **The User Complaint:**
  > *"I evaluated a referee and recommended them for Tier 150. The screen said 'Evaluation submitted successfully!', but when the admin looks at the referee roster, their suggested tier never changed."*
- **Why it breaks:**
  Firestore rejects the `updateDoc` with `permission-denied`. Because the code wraps it in a `try...catch` that only does `console.error()`, the error is swallowed silently. The app tells the evaluator everything succeeded, but the referee profile was never updated.
- **The Fix:**
  Either update `firestore.rules` to allow evaluators to update only the `suggestedTier` field:
  ```
  allow update: if isAuthenticated() && (
    isAdmin() ||
    (isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status'])) ||
    (isEvaluator() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['suggestedTier']))
  );
  ```
  Or update `suggestedTier` using a Cloud Function trigger on `evaluations/{id}` write so it runs with admin privileges.

---

### Bug 4: Editing Group Evaluations Overwrites Total Score with One Official's Score
- **File:** `src/features/admin/pages/Evaluation.jsx` (Lines 213–240)
- **What happens:**
  When an admin opens a group evaluation (e.g., 3 officials) and edits scores or comments, line 215 calculates:
  ```javascript
  const newTotalScore = Object.values(editForm.scores).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  ```
  `editForm.scores` only holds the scores for the **one active official tab** currently open.
  Then line 236 writes:
  ```javascript
  await updateDoc(evalRef, {
    scores: updatedScoresPayload,
    totalScore: newTotalScore, // <--- OVERWRITES THE TOP-LEVEL FIELD
    comments: updatedCommentsPayload,
    recommendations: editForm.recommendations,
    tier: editForm.tierAssigned,
  });
  ```
- **The User Complaint:**
  > *"We had a 3-referee crew game with a total score of 102. I opened the evaluation to fix a spelling typo in Official 2's notes and hit Save. Now the entire game shows a total score of 34 on the dashboard and evaluations list!"*
- **Why it breaks:**
  The top-level `totalScore` field on the evaluation is overwritten with just 1 official's individual score instead of preserving the group total or calculating the sum across all officials in `updatedScoresPayload`.
- **The Fix:**
  Calculate total score across all officials in the group payload:
  ```javascript
  let calculatedTotal = 0;
  if (isGroup) {
    Object.values(updatedScoresPayload).forEach(officialScores => {
      if (officialScores && typeof officialScores === 'object') {
        calculatedTotal += Object.values(officialScores).reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
    });
  } else {
    calculatedTotal = Object.values(editForm.scores).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  await updateDoc(evalRef, {
    scores: updatedScoresPayload,
    totalScore: calculatedTotal,
    ...
  });
  ```

---

## 2. Data Inconsistency & Broken Stats

### Bug 5: Evaluator "# OF EVALUATIONS" Always Shows 0
- **Files:**
  - `src/features/admin/pages/Evaluators.jsx` (Lines 131, 378, 425)
  - `src/features/evaluator/pages/EvaluationReview.jsx` (Lines 166–196)
- **What happens:**
  When an evaluator is created in `Evaluators.jsx` line 131, `evaluationsMade: 0` is set in Firestore.
  When an evaluator actually submits an evaluation in `EvaluationReview.jsx`, `evaluationsMade` is **never incremented**.
- **The User Complaint:**
  > *"The Evaluator table has a column '# OF EVALUATIONS', but every single evaluator shows '0', even though they have submitted 30 evaluations."*
- **The Fix:**
  In `EvaluationReview.jsx` line 167, right after `addDoc(collection(db, 'evaluations'), evaluationData)`:
  ```javascript
  import { increment } from 'firebase/firestore';

  // Increment the evaluator's stats counter
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      evaluationsMade: increment(1),
    });
  } catch (err) {
    console.error("Failed to increment evaluator evaluationsMade:", err);
  }
  ```

---

### Bug 6: Arbitrary limit(200) Wipes Out Stats for Active Referees
- **File:** `src/features/admin/pages/Referees.jsx` (Lines 121, 55–69)
- **What happens:**
  `Referees.jsx` calculates referee statistics (evaluations count, average score, suggested tier) by querying:
  ```javascript
  const evalsQuery = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'), limit(200));
  ```
  Then in memory, it filters:
  ```javascript
  const refereeEvals = allEvaluations.filter(e => e.refereeId === referee.id || ...);
  ```
- **The User Complaint:**
  > *"I am a referee who worked games earlier in the season. On my profile I have evaluations, but on the Master Roster table it says I have '0' evaluations and '0.0' average score."*
- **Why it breaks:**
  As soon as the chapter surpasses 200 total evaluations across all referees, any evaluation older than document #200 is dropped from the query. Referees whose games occurred earlier in the season have their stats wiped clean on this screen.
- **The Fix:**
  Do not compute stats by downloading a capped slice of the evaluations collection. Maintain rolling stats directly on the referee's user document (`evaluationsCount`, `totalScoreSum`, `avgScore`). When an evaluation is saved:
  ```javascript
  await updateDoc(doc(db, 'users', refereeId), {
    evaluationsCount: increment(1),
    totalScoreSum: increment(score),
  });
  ```
  Then `Referees.jsx` simply displays `referee.evaluationsCount` and `(referee.totalScoreSum / referee.evaluationsCount).toFixed(1)`. It loads instantly and never drops data.

---

### Bug 7: Dashboard Stats & Top Officials Break Past 500 Evaluations
- **File:** `src/features/admin/pages/Dashboard.jsx` (Lines 64, 108–145)
- **What happens:**
  Dashboard stats ("Total Officials", "Evaluations This Week", "Average Rating", "Top Tier Officials") are calculated by fetching:
  ```javascript
  const evaluationsQuery = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'), limit(500));
  ```
  It loops through those 500 items to calculate averages and identify the top 3 referees.
- **The User Complaint:**
  > *"Our league has completed 800 evaluations, but our Average Rating and Top Officials list only reflect recent games. Referees who performed well earlier disappeared from the leaderboard."*
- **The Fix:**
  Use Firestore native aggregation `getCountFromServer()` for counts, or maintain a single `system_stats/overview` document updated via Cloud Function when evaluations are written.

---

### Bug 8: Inverted Referee Tier Progress Bar (Tier 100 Shows 0% Progress)
- **File:** `src/features/referee/pages/Home.jsx` (Lines 111–119, 149–153, 296–300)
- **What happens:**
  NTBOA rankings follow Texas high school basketball rules: **Tier 100 is the highest rank** (eligible for 6A Varsity / State Playoffs), while Tier 800 is the lowest rank (first-year middle school).
  In `Home.jsx`, the progress bar calculation does:
  ```javascript
  const currentTierPoints = userData.tierPoints || 150;
  // tierMin: 100, tierMax: 300
  const clampedProgress = Math.min(
    Math.max(((tierProgress - tierMin) / (tierMax - tierMin)) * 100, 0),
    100
  );
  ```
- **The User Complaint:**
  > *"I just got promoted to Tier 100 (top official rank). But on my home dashboard, my Tier Progression bar is completely empty (0%)! A Tier 300 rookie has a 100% full bar!"*
- **Why it breaks:**
  The mathematical formula assumes higher number = more progress. `(100 - 100) / (300 - 100) = 0%`.
- **The Fix:**
  Invert the formula so that reaching Tier 100 represents 100% completion:
  ```javascript
  // Lower tier number means higher rank
  const progressPercent = Math.min(
    Math.max(((tierMax - currentTierNumber) / (tierMax - tierMin)) * 100, 0),
    100
  );
  ```

---

### Bug 9: Fake Hardcoded "+1.2%" Trend Arrow on Referee Home
- **File:** `src/features/referee/pages/Home.jsx` (Lines 21, 115, 165–167)
- **What happens:**
  Under the referee's Average Score card, there is a green arrow: `↑ +1.2%`.
  Looking at line 115:
  ```javascript
  averageDelta: '+1.2%',
  ```
  It is a hardcoded string. Every single referee sees "+1.2%" regardless of whether their score went up, plummeted, or if they only have 1 game.
- **The User Complaint:**
  > *"My score dropped from 39 to 32 after a bad game, but the dashboard still shows a green arrow saying '+1.2%'. The stats look fake."*
- **The Fix:**
  Either calculate the delta between the latest evaluation and the running average, or hide the delta element until historical comparison logic is implemented:
  ```javascript
  // If only 1 evaluation exists, show no delta
  const delta = previousAvg > 0 ? (((currentAvg - previousAvg) / previousAvg) * 100).toFixed(1) : null;
  ```

---

## 3. Excel Import Flaws & Schema Breaking

### Bug 10: Import Center Creates Incompatible Database Schemas
- **Files:**
  - `src/features/admin/pages/ImportCenter.jsx` (Lines 227–236)
  - `src/features/admin/pages/Referees.jsx` (Lines 327–340)
  - `src/features/admin/pages/Evaluators.jsx` (Lines 125–134)
- **What happens:**
  When a referee is created manually in `Referees.jsx`, the document schema has:
  ```javascript
  {
    displayName: "John Doe",
    email: "john@example.com",
    role: "referee",
    tier: "Tier 100",
    avgScore: 0,
    evaluations: 0,
    status: "Active",
    suggestedTier: ""
  }
  ```
  When imported via `ImportCenter.jsx` line 227, the document schema is completely different:
  ```javascript
  {
    displayName: name,
    email: email,
    role: role,
    tier: tier,
    stats: { evaluations: 0, score: 0 } // <-- Nested object!
    // MISSING: status: 'Active'
    // MISSING: avgScore: 0
    // MISSING: evaluations: 0
    // MISSING: photoURL: ''
    // MISSING: evaluationsMade (for evaluators)
  }
  ```
- **The User Complaint:**
  > *"After importing our roster from Excel, imported referees don't show up when sorting by status, their evaluation counts are broken, and imported evaluators crash the evaluators table."*
- **The Fix:**
  Make `ImportCenter.jsx` use the exact same schema as `Referees.jsx` and `Evaluators.jsx`:
  ```javascript
  const userPayload = {
    uid,
    displayName: name,
    email: email,
    role: role,
    createdAt: serverTimestamp(),
    photoURL: '',
    status: 'Active',
  };

  if (role === 'referee') {
    userPayload.tier = tier || 'Tier 100';
    userPayload.avgScore = 0;
    userPayload.evaluations = 0;
    userPayload.suggestedTier = '';
  } else if (role === 'evaluator') {
    userPayload.evaluationsMade = 0;
  }

  await setDoc(doc(db, 'users', uid), userPayload);
  ```

---

### Bug 11: Excel Serial Date Numbers Crash Schedule Import with "Invalid Date"
- **File:** `src/features/admin/pages/ImportCenter.jsx` (Lines 310–313)
- **What happens:**
  When importing the Schedule sheet, line 311 does:
  ```javascript
  const d = new Date(`${dateStr} ${timeStr}`);
  if (isNaN(d.getTime())) throw new Error("Invalid Date");
  ```
  Microsoft Excel stores dates internally as numeric serial numbers (e.g., `45312` for Jan 21, 2024, and `0.5833` for 14:00). When `XLSX.utils.sheet_to_json` reads cells formatted as dates without `{ raw: false }`, `dateStr` becomes the number `45312`.
  `new Date("45312 0.5833")` returns `Invalid Date`.
- **The User Complaint:**
  > *"I uploaded our master schedule Excel file and every single row failed with 'Invalid Date'!"*
- **The Fix:**
  In `ImportCenter.jsx` line 111, configure the XLSX parser to format dates as strings:
  ```javascript
  const jsonData = XLSX.utils.sheet_to_json(ws, { 
    defval: "",
    raw: false, // Ensures dates are converted to "YYYY-MM-DD" text
    dateNF: 'yyyy-mm-dd'
  });
  ```

---

### Bug 12: createUser() Arguments Mismatch
- **Files:**
  - `src/features/admin/pages/ImportCenter.jsx` (Line 223)
  - `src/features/authentication/services/authService.js` (Line 37)
- **What happens:**
  In `ImportCenter.jsx` line 223:
  ```javascript
  const userCred = await createUser(email, generateRandomPassword(), name, role);
  ```
  In `authService.js` line 37:
  ```javascript
  export const createUser = async (email, password) => { ... }
  ```
  `createUser` only accepts 2 arguments. `name` and `role` are silently ignored. While this does not throw an error because the subsequent `setDoc` writes the fields to Firestore, it leads developers to believe `createUser` is configuring the user profile in Auth.

---

## 4. Session Leaks & Shared Computer Contamination

### Bug 13: Unscoped localStorage Causes Profile Identity Leaks Between Users
- **Files:**
  - `src/features/admin/pages/Settings.jsx` (Lines 49, 110, 184)
  - `src/features/authentication/services/authService.js` (Lines 25–27)
  - `src/features/authentication/components/AuthProvider.jsx` (Lines 29–35)
- **What happens:**
  `Settings.jsx` caches the admin's name, email, phone, and photo in browser storage under a fixed key:
  ```javascript
  localStorage.setItem('ntboa_admin_profile', JSON.stringify(profileData));
  ```
  When Admin A logs out, `logout()` in `authService.js` only calls `signOut(auth)`. It **does not clear localStorage**.
  When Admin B logs in on the same computer and navigates to Settings, line 49 reads Admin A's saved profile from `localStorage`! If Admin B clicks "Save Changes", it overwrites Admin B's Firestore document with Admin A's name and photo.
- **The User Complaint:**
  > *"I logged into the admin portal on our chapter office laptop. My profile showed the previous president's name and photo, and when I clicked Save it overwrote my account with their information."*
- **The Fix:**
  1. Scope all cached data keys to the user's UID:
     ```javascript
     const cacheKey = `ntboa_profile_${user.uid}`;
     localStorage.setItem(cacheKey, JSON.stringify(profileData));
     ```
  2. Clear all cached storage on `logout()`:
     ```javascript
     export const logout = async () => {
       if (typeof window !== 'undefined') {
         localStorage.clear();
         sessionStorage.clear();
       }
       return signOut(auth);
     };
     ```

---

### Bug 14: Hardcoded "John / JS" Fallbacks in Evaluator Pages
- **Files:**
  - `src/features/evaluator/pages/NewEvaluation.jsx` (Lines 20–35)
  - `src/features/evaluator/pages/GameContext.jsx` (Lines 27–42)
  - `src/features/evaluator/pages/EvaluationDetails.jsx` (Lines 34–49)
  - `src/features/evaluator/pages/Evaluations.jsx` (Lines 19–33)
- **What happens:**
  Every evaluator page has this hardcoded fallback:
  ```javascript
  const [userData, setUserData] = useState({ name: 'John', initials: 'JS' });
  ```
  If `localStorage.getItem('evaluatorProfile')` is empty (e.g. first login or fresh browser), the app displays "Welcome John" with initials "JS" in the header, regardless of who is actually logged in.
- **The User Complaint:**
  > *"My name is Marcus, but my evaluation screen says 'Welcome John' and shows initials 'JS'."*
- **The Fix:**
  Remove the `localStorage` fallback and use `useAuth().userData.displayName`:
  ```javascript
  const { userData } = useAuth();
  const displayName = userData?.displayName || 'Evaluator';
  ```

---

## 5. Performance & Unbounded Queries

### Bug 15: Assignments Page Downloads Every Assignment Ever Created
- **File:** `src/features/admin/pages/Assignments.jsx` (Line 322)
- **What happens:**
  ```javascript
  getDocs(query(collection(db, 'assignments')))
  ```
  There is no date filter, no status filter, and no limit. It downloads every game assignment across all seasons into client memory.
- **The User Complaint:**
  > *"At the start of the year the Assignments page was fast. Now in season 2 it takes 8 seconds to load and the browser stutters."*
- **The Fix:**
  Partition assignments by date so only the active season or ±45 days is loaded by default:
  ```javascript
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);

  const q = query(
    collection(db, 'assignments'),
    where('scheduledDate', '>=', windowStart),
    orderBy('scheduledDate', 'asc')
  );
  ```

---

### Bug 16: Evaluator History Has No Order By and Cuts Off at 50 Items
- **Files:**
  - `src/features/evaluator/services/evaluationService.js` (Lines 120–132)
  - `src/features/evaluator/pages/Evaluations.jsx` (Line 40)
- **What happens:**
  `getEvaluationsByEvaluator` executes:
  ```javascript
  const queryConstraints = [
    where('evaluatorId', '==', evaluatorId),
    limit(pageSize) // defaults to 50
  ];
  ```
  It has **no `orderBy` clause**. In Firestore, a query without `orderBy` returns documents in arbitrary Document ID order, not chronological order. Furthermore, `Evaluations.jsx` does not render a "Load More" button or pagination control.
- **The User Complaint:**
  > *"My evaluation history is jumbled up out of order, and I can't find evaluations I did two months ago—they're completely missing from the list."*
- **The Fix:**
  Add `orderBy('createdAt', 'desc')` and implement pagination:
  ```javascript
  const queryConstraints = [
    where('evaluatorId', '==', evaluatorId),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  ];
  ```

---

### Bug 17: Downloading Full Users Collection to Map Names
- **Files:**
  - `src/features/admin/pages/Dashboard.jsx` (Line 69)
  - `src/features/admin/pages/Evaluations.jsx` (Line 123)
- **What happens:**
  Both pages call `getDocs(collection(db, 'users'))` solely to build an in-memory dictionary (`userMap[id] = user.displayName`).
- **The Impact:**
  Every time an admin opens Dashboard or Evaluations, 100% of user accounts are downloaded. As the chapter grows to 500+ users, this wastes Firestore reads and slows page loads.
- **The Fix:**
  Denormalize names onto evaluation documents at creation time:
  ```javascript
  // When saving in EvaluationReview.jsx:
  evaluationData.evaluatorName = user.displayName;
  evaluationData.refereeName = official.name;
  ```
  Then the evaluations list and dashboard read names directly from the evaluation document with zero user lookups.

---

## 6. Summary Checklist (Prioritized by Severity)

| Priority | Issue | Affected Files | Effort | Why Fix It |
| :---: | :--- | :--- | :---: | :--- |
| 🔴 **P0** | **URL Parameter Length Crash** | `EvaluationForm.jsx`, `EvaluationReview.jsx` | 30 min | Prevents lost evaluations and blank-screen crashes on mobile |
| 🔴 **P0** | **Base64 Photo Memory Bomb** | `Profile.jsx`, `Settings.jsx`, `authService.js` | 1 hour | Stops 40MB+ payloads that freeze browsers and spike costs |
| 🔴 **P0** | **Permission Denied on Suggested Tier** | `EvaluationReview.jsx`, `firestore.rules` | 15 min | Fixes silent failure where recommended tiers never save |
| 🔴 **P0** | **Group Evaluation Score Corruption** | `Evaluation.jsx` (Admin) | 20 min | Prevents editing group evals from overwriting total scores |
| 🟠 **P1** | **Evaluator "# OF EVALUATIONS" is 0** | `EvaluationReview.jsx`, `Evaluators.jsx` | 5 min | Makes evaluator activity numbers accurate |
| 🟠 **P1** | **limit(200) Drops Referee Stats** | `Referees.jsx` | 45 min | Stops veteran referees from showing 0 evals on roster |
| 🟠 **P1** | **Import Schema Mismatches** | `ImportCenter.jsx` | 30 min | Ensures imported users match the database schema |
| 🟠 **P1** | **Excel Serial Date Import Crash** | `ImportCenter.jsx` | 10 min | Fixes schedule import failure with "Invalid Date" |
| 🟡 **P2** | **Inverted Tier Progress Bar** | `Home.jsx` (Referee) | 15 min | Fixes Tier 100 showing 0% progress |
| 🟡 **P2** | **Fake Hardcoded "+1.2%" Delta** | `Home.jsx` (Referee) | 10 min | Removes misleading trend arrow |
| 🟡 **P2** | **localStorage Shared Computer Leak** | `Settings.jsx`, `authService.js` | 20 min | Prevents account contamination on shared office laptops |
| 🟡 **P2** | **Hardcoded "John / JS" Defaults** | Evaluator pages | 15 min | Shows actual user name instead of "John" |
| 🟢 **P3** | **Unbounded Assignments Query** | `Assignments.jsx` | 20 min | Keeps page fast as seasons accumulate |
| 🟢 **P3** | **Missing OrderBy in History** | `evaluationService.js`, `Evaluations.jsx` | 15 min | Orders evaluations chronologically |
| 🟢 **P3** | **Full Users Query for Name Mapping** | `Dashboard.jsx`, `Evaluations.jsx` | 30 min | Eliminates full database scans on page load |
