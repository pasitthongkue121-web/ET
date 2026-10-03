'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getUserName } from '../lib/auth';

export default function LogoutButton() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(getUserName());
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <div className="flex items-center gap-2">
      {name && (
        <span className="text-xs text-slate-400 hidden sm:inline">
          👤 {name}
        </span>
      )}
      <button
        onClick={handleLogout}
        className="text-xs text-slate-400 hover:text-red-400 transition px-2 py-1 rounded border border-slate-700 hover:border-red-500"
      >
        Logout
      </button>
    </div>
  );
}

