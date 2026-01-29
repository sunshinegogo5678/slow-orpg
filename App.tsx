import React, { useState, useEffect } from 'react';
import { ViewState, Character } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Playroom from './components/Playroom';
import CreateCampaign from './components/CreateCampaign';
import MyPage from './components/MyPage';
import CharacterCreation from './components/CharacterCreation';
import Onboarding from './components/Onboarding';
import { Moon, Sun, Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

export default function App() {
  const { session, signOut, loading: authLoading } = useAuth();
  const [view, setView] = useState<ViewState | 'edit-character'>('login');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  
  // State to hold the character being edited
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // Initialize theme based on system preference
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Toggle class on html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Browser Back Button (popstate)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
        if (event.state.sessionId) {
            setActiveSessionId(event.state.sessionId);
        } else {
            setActiveSessionId(null);
        }
      } else {
         // Default fallback based on auth
         if (session) {
             setView('dashboard');
             setActiveSessionId(null);
         } else {
             setView('login');
         }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session]);

  // Auth & Profile State Listener
  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (!session) {
        setView('login');
        return;
      }

      // If we are already in an authenticated view and just refreshing, logic below handles it.
      // But if we are at 'login', we need to decide where to go.
      
      setIsCheckingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', session.user.id)
          .single();

        // If profile exists and has a nickname
        if (data && data.nickname) {
           // Prevent overriding specific deep-link like logic if we had it, but for now simple:
           if (view === 'login' || view === 'onboarding') {
              setView('dashboard');
              // Replace state to prevent going back to login
              window.history.replaceState({ view: 'dashboard' }, '', '#dashboard');
           }
        } else {
           // No profile or no nickname -> Force onboarding
           setView('onboarding');
        }
      } catch (err) {
        console.error("Profile check failed:", err);
        // Fallback to onboarding on error (safest bet) or stay at login if critical
        setView('onboarding');
      } finally {
        setIsCheckingProfile(false);
      }
    };

    if (!authLoading) {
       checkProfileAndRedirect();
    }
  }, [session, authLoading]); // Removed 'view' from dependency to avoid loops, handled logic inside

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Navigation Helpers (with History Push) ---
  
  const handleJoinSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setView('playroom');
    window.history.pushState({ view: 'playroom', sessionId }, '', `#session/${sessionId}`);
  };

  const handleGoToDashboard = () => {
    setActiveSessionId(null);
    setView('dashboard');
    window.history.pushState({ view: 'dashboard' }, '', '#dashboard');
  };

  const handleCreateCampaign = () => {
      setView('create-campaign');
      window.history.pushState({ view: 'create-campaign' }, '', '#create-campaign');
  }

  const handleOpenSettings = () => {
      setView('mypage');
      window.history.pushState({ view: 'mypage' }, '', '#mypage');
  }

  const handleEditCharacter = (char: Character) => {
    setEditingCharacter(char);
    setView('edit-character');
    window.history.pushState({ view: 'edit-character' }, '', '#edit-character');
  };

  const handleLogout = async () => {
    await signOut();
    setView('login');
    window.history.pushState({ view: 'login' }, '', '#login');
  };

  if (authLoading || (session && isCheckingProfile && view === 'login')) {
     return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
           <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        </div>
     );
  }

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login />;
      case 'onboarding':
        return <Onboarding onComplete={handleGoToDashboard} />;
      case 'dashboard':
        return (
          <Dashboard 
            onJoinSession={handleJoinSession}
            onLogout={handleLogout} 
            onCreateSession={handleCreateCampaign}
            onOpenSettings={handleOpenSettings}
          />
        );
      case 'create-campaign':
        return <CreateCampaign onCancel={handleGoToDashboard} onCreate={handleGoToDashboard} />;
      case 'playroom':
        return (
          <Playroom 
            campaignId={activeSessionId || ''}
            onExit={handleGoToDashboard} 
            onCreateCharacter={() => {
              setEditingCharacter(null); // Reset for creation
              setView('create-character');
              window.history.pushState({ view: 'create-character' }, '', '#create-character');
            }}
            onEditCharacter={handleEditCharacter}
            onOpenSettings={handleOpenSettings}
          />
        );
      case 'mypage':
        return <MyPage onBack={handleGoToDashboard} onLogout={handleLogout} />;
      case 'create-character':
        return (
          <CharacterCreation 
            campaignId={activeSessionId || 'unknown'}
            initialData={null}
            onCancel={() => {
                // Return to playroom, but standard back is handled by history if available
                if (window.history.state && window.history.state.view === 'create-character') {
                     window.history.back();
                } else {
                     setView('playroom');
                }
            }} 
            onSubmit={(data) => {
              console.log("Created Character:", data);
              // Go back to playroom
              setView('playroom');
              window.history.replaceState({ view: 'playroom', sessionId: activeSessionId }, '', `#session/${activeSessionId}`);
            }} 
          />
        );
      case 'edit-character':
        return (
          <CharacterCreation 
            campaignId={activeSessionId || 'unknown'}
            initialData={editingCharacter}
            onCancel={() => {
                if (window.history.state && window.history.state.view === 'edit-character') {
                     window.history.back();
                } else {
                     setView('playroom');
                }
            }} 
            onSubmit={(data) => {
              console.log("Updated Character:", data);
              setView('playroom');
              window.history.replaceState({ view: 'playroom', sessionId: activeSessionId }, '', `#session/${activeSessionId}`);
            }} 
          />
        );
      default:
        return <Login />;
    }
  };

  return (
    <div className="min-h-screen w-full font-sans transition-colors duration-200">
      {/* Global Theme Toggle (Absolute for demo purposes if not in header) */}
      {(view === 'login' || view === 'onboarding') && (
        <button
          onClick={toggleTheme}
          className="fixed top-6 right-6 p-2 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors z-50"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      )}

      {renderView()}
    </div>
  );
}