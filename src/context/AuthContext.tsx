import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isRealSupabase, profileService } from '../lib/supabase';
import { UserProfile, ProfileSeedOptions } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  selectProfile: (profile: UserProfile) => void;
  createProfile: (profileData: Omit<UserProfile, 'id' | 'created_at'>, seedOptions?: ProfileSeedOptions) => Promise<UserProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  enterAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Helper to load account profile directly for the authenticated user
  const loadUserProfiles = async (currentUserId?: string, userObj?: User | null) => {
    const uid = currentUserId || userObj?.id || user?.id || 'guest_user';
    const emailStr = userObj?.email || user?.email || '';
    const nameStr = userObj?.user_metadata?.name || user?.user_metadata?.name || (emailStr ? emailStr.split('@')[0] : 'Αναλυτής');

    const accountProfile: UserProfile = {
      id: uid,
      user_id: uid,
      name: nameStr,
      role: 'Αναλυτής Τακτικής',
      team_name: 'DataVis Analytics',
      color: '#10b981',
      created_at: new Date().toISOString()
    };

    setProfiles([accountProfile]);
    setActiveProfile(accountProfile);
    profileService.setActiveProfileId(uid);
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setLoading(true);

      // Check if guest user was previously active
      const isGuest = localStorage.getItem('fm_is_guest') === 'true';
      if (isGuest && (!isRealSupabase || !supabase)) {
        const guestUser: any = {
          id: 'guest_user',
          email: 'guest@datavis.com',
          user_metadata: { name: 'Guest Analyst' }
        };
        setUser(guestUser);
        await loadUserProfiles('guest_user', guestUser);
        setLoading(false);
        return;
      }

      if (isRealSupabase && supabase) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession?.user) {
              await loadUserProfiles(currentSession.user.id, currentSession.user);
            }
          }
        } catch (err: any) {
          console.error("Auth session check error:", err);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (!mounted) return;
          setSession(newSession);
          setUser(newSession?.user ?? null);
          if (newSession?.user) {
            await loadUserProfiles(newSession.user.id, newSession.user);
          } else {
            setProfiles([]);
            setActiveProfile(null);
            profileService.setActiveProfileId(null);
          }
        });

        if (mounted) {
          setLoading(false);
        }

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } else {
        // Supabase not configured: fallback to local guest mode
        const guestUser: any = {
          id: 'guest_user',
          email: 'analyst@datavis.local',
          user_metadata: { name: 'Local Analyst' }
        };
        setUser(guestUser);
        await loadUserProfiles('guest_user', guestUser);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    if (!isRealSupabase || !supabase) {
      // Fallback sign in
      const mockUser: any = { id: 'user_' + btoa(email).slice(0, 8), email };
      setUser(mockUser);
      localStorage.removeItem('fm_is_guest');
      await loadUserProfiles(mockUser.id, mockUser);
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      setUser(data.user);
      setSession(data.session);
      localStorage.removeItem('fm_is_guest');
      if (data.user) {
        await loadUserProfiles(data.user.id, data.user);
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const signUp = async (email: string, password: string) => {
    setAuthError(null);
    if (!isRealSupabase || !supabase) {
      const mockUser: any = { id: 'user_' + btoa(email).slice(0, 8), email };
      setUser(mockUser);
      await loadUserProfiles(mockUser.id, mockUser);
      return { success: true, message: 'Account created successfully (Local mode).' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }

      // Supabase may require email confirmation or may auto-sign in
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Registration successful! Please check your email to confirm your account before logging in.'
        };
      }

      setUser(data.user);
      setSession(data.session);
      if (data.user) {
        await loadUserProfiles(data.user.id, data.user);
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const signOut = async () => {
    if (isRealSupabase && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Supabase signOut error:", err);
      }
    }
    localStorage.removeItem('fm_is_guest');
    profileService.setActiveProfileId(null);
    setUser(null);
    setSession(null);
    setProfiles([]);
    setActiveProfile(null);
  };

  const enterAsGuest = () => {
    localStorage.setItem('fm_is_guest', 'true');
    const guestUser: any = {
      id: 'guest_user',
      email: 'guest@datavis.com',
      user_metadata: { name: 'Guest Analyst' }
    };
    setUser(guestUser);
    loadUserProfiles('guest_user', guestUser);
  };

  const selectProfile = (profile: UserProfile) => {
    profileService.setActiveProfileId(profile.id);
    setActiveProfile(profile);
  };

  const createProfile = async (
    profileData: Omit<UserProfile, 'id' | 'created_at'>, 
    seedOptions?: ProfileSeedOptions
  ): Promise<UserProfile> => {
    const newProfile: UserProfile = {
      id: `prof_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: user?.id || 'guest',
      ...profileData,
      created_at: new Date().toISOString()
    };

    const created = await profileService.createProfile(newProfile, seedOptions);
    await loadUserProfiles(user?.id);
    selectProfile(created);
    return created;
  };

  const deleteProfile = async (profileId: string) => {
    await profileService.deleteProfile(profileId, user?.id);
    await loadUserProfiles(user?.id);
    if (activeProfile?.id === profileId) {
      setActiveProfile(null);
      profileService.setActiveProfileId(null);
    }
  };

  const refreshProfiles = async () => {
    await loadUserProfiles(user?.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profiles,
        activeProfile,
        authError,
        signIn,
        signUp,
        signOut,
        selectProfile,
        createProfile,
        deleteProfile,
        refreshProfiles,
        enterAsGuest
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
