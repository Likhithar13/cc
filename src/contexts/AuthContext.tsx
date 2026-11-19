import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { ensureUserProfile } from '../services/firestoreService';
import { UserProfile, UserRole } from '../types/bloodBank';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  effectiveRole: UserRole;
  previewStaffMode: boolean;
  setPreviewStaffMode: (val: boolean) => void;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerStaffAccount: (params: {
    fullName: string;
    email: string;
    password: string;
    department?: string;
    phone?: string;
  }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('auth/operation-not-allowed') || raw.includes('PASSWORD_LOGIN_DISABLED')) {
    return 'Email/Password authentication is currently disabled in Firebase Console (Authentication > Sign-in method). Enable the Email/Password provider in Firebase Console or use Continue with Google.';
  }
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Invalid email address or password. Please check your credentials and try again.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing authentication.';
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [previewStaffMode, setPreviewStaffMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingSignupRef = useRef<{
    email: string;
    displayName: string;
    department?: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setPreviewStaffMode(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const pendingMeta =
          pendingSignupRef.current &&
          pendingSignupRef.current.email.toLowerCase() === (user.email || '').toLowerCase()
            ? pendingSignupRef.current
            : null;
        if (pendingMeta) {
          pendingSignupRef.current = null;
        }

        const ensured = await ensureUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName:
            pendingMeta?.displayName ||
            user.displayName ||
            user.email?.split('@')[0] ||
            'Demo User',
          department: pendingMeta?.department,
          phone: pendingMeta?.phone,
        });
        setUserProfile(ensured);

        unsubProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setUserProfile({
                id: snap.id,
                uid: d.uid,
                email: d.email,
                displayName: d.displayName,
                role:
                  String(d.email || '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
                    ? 'admin'
                    : d.role === 'admin'
                      ? 'admin'
                      : 'staff',
                status:
                  d.status === 'disabled'
                    ? 'disabled'
                    : d.status === 'pending'
                      ? 'pending'
                      : 'active',
                department: d.department,
                phone: d.phone ?? '',
              });
            }
            setLoading(false);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }
        );
      } catch (err) {
        setAuthError(friendlyAuthError(err));
        setLoading(false);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = friendlyAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = friendlyAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const registerStaffAccount = async (params: {
    fullName: string;
    email: string;
    password: string;
    department?: string;
    phone?: string;
  }): Promise<void> => {
    setAuthError(null);
    const cleanEmail = params.email.trim();
    const cleanName = params.fullName.trim();
    pendingSignupRef.current = {
      email: cleanEmail,
      displayName: cleanName,
      department: params.department,
      phone: params.phone,
    };
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        params.password
      );
      await updateProfile(cred.user, { displayName: cleanName });
      const profile = await ensureUserProfile({
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: cleanName,
        department: params.department,
        phone: params.phone,
      });
      setUserProfile(profile);
    } catch (err) {
      pendingSignupRef.current = null;
      const msg = friendlyAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = friendlyAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setAuthError(null);
    setPreviewStaffMode(false);
    await signOut(auth);
  };

  const actualRole: UserRole = userProfile?.role === 'admin' ? 'admin' : 'staff';
  const effectiveRole: UserRole =
    actualRole === 'admin' && previewStaffMode ? 'staff' : actualRole;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        effectiveRole,
        previewStaffMode,
        setPreviewStaffMode,
        loading,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signInWithEmail,
        registerStaffAccount,
        sendPasswordReset,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
