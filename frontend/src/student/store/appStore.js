// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — store/appStore.js
// Global state: Zustand + localStorage persistence
// Ref: developer_skill.md §8
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({

      // ── Hub ──────────────────────────────────────────────────────────────────
      hubStatus: 'disconnected', // 'connected' | 'disconnected' | 'checking'
      hubName:   'SK Kg. Baru Node',
      lastSync:  '2 hours ago',
      setHubStatus: (status) => set({ hubStatus: status }),
      setHubName:   (name)   => set({ hubName: name }),
      setLastSync:  (time)   => set({ lastSync: time }),

      // ── Auth ─────────────────────────────────────────────────────────────────
      currentUser: null,
      userRole: null, // 'student' or 'teacher'
      isAuthenticated: false,
      isLoading: true,

      setCurrentUser: (user) => set({ currentUser: user, isAuthenticated: !!user }),
      setUserRole: (role) => set({ userRole: role }),
      setIsLoading: (loading) => set({ isLoading: loading }),

      // ── User ─────────────────────────────────────────────────────────────────
      // Shape: { name, grade, village, parentPhone, smsEnabled }
      user: null,
      setUser:    (user)  => set({ user }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : patch })),

      // ── Learning ─────────────────────────────────────────────────────────────
      currentLesson:    null,
      setCurrentLesson: (lesson) => set({ currentLesson: lesson }),

      // { [lessonId]: 0–100 }
      progress: {},
      setProgress: (lessonId, pct) =>
        set((s) => ({ progress: { ...s.progress, [lessonId]: pct } })),
      getProgress: (lessonId) => get().progress[lessonId] ?? 0,

      // [{ lessonId, score, total, date, subject }]
      quizResults: [],
      addQuizResult: (result) =>
        set((s) => ({
          quizResults: [
            { ...result, date: new Date().toLocaleDateString('en-MY') },
            ...s.quizResults,
          ],
        })),

      streak: 7,
      setStreak:       (n) => set({ streak: n }),
      incrementStreak: ()  => set((s) => ({ streak: s.streak + 1 })),

      // ── UI ───────────────────────────────────────────────────────────────────
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // [{ role: 'student'|'tutor', text, timestamp }]
      tutorHistory: [],
      addTutorMessage: (msg) =>
        set((s) => ({
          tutorHistory: [...s.tutorHistory, { ...msg, timestamp: Date.now() }],
        })),
      clearTutorHistory: () => set({ tutorHistory: [] }),

      // { overall, content, language, structure, feedback } | null
      essayResult: null,
      setEssayResult:  (r) => set({ essayResult: r }),
      clearEssayResult: () => set({ essayResult: null }),

      // ── Derived ──────────────────────────────────────────────────────────────
      isHubConnected: () => get().hubStatus === 'connected',
    }),
    {
      name: 'cryptedu-state',
      partialise: (s) => ({
        user:        s.user,
        progress:    s.progress,
        quizResults: s.quizResults,
        streak:      s.streak,
        hubName:     s.hubName,
        lastSync:    s.lastSync,
      }),
    }
  )
);

export default useAppStore;
