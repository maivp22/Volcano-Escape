import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  nickname: string;
  victories: number;
  gamesPlayed: number;
  roundsSurvived: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile({ uid: user.uid, ...snapshot.data() } as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching profile:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const setNickname = async (nickname: string) => {
    if (!user) return;
    const cleanNickname = nickname.trim().replace(/\s/g, '');
    if (cleanNickname.length < 2 || cleanNickname.length > 12) {
      throw new Error("Nickname must be between 2 and 12 characters and contain no spaces.");
    }

    await setDoc(doc(db, 'users', user.uid), {
      nickname: cleanNickname,
      victories: 0,
      gamesPlayed: 0,
      roundsSurvived: 0,
      updatedAt: serverTimestamp()
    });
  };

  const updateNickname = async (nickname: string) => {
    if (!user) return;
    const cleanNickname = nickname.trim().replace(/\s/g, '');
    if (cleanNickname.length < 2 || cleanNickname.length > 12) {
      throw new Error("Nickname must be between 2 and 12 characters and contain no spaces.");
    }

    await updateDoc(doc(db, 'users', user.uid), {
      nickname: cleanNickname,
      updatedAt: serverTimestamp()
    });
  };

  return { user, profile, loading, setNickname, updateNickname };
}
