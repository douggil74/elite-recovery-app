'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// URL to the deployed recovery app
const RECOVERY_APP_URL = 'https://recovery-app-blond.vercel.app';

export default function AppRedirect() {
  useEffect(() => {
    // Auto-redirect after a brief delay
    const timer = setTimeout(() => {
      window.location.href = RECOVERY_APP_URL;
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Loading animation */}
        <div className="w-16 h-16 mx-auto mb-8 relative">
          <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-red-600 rounded-full animate-spin" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          Accessing Recovery <span className="text-red-500">Software</span>
        </h1>

        <p className="text-zinc-400 mb-8">
          Redirecting to the secure case management system...
        </p>

        <div className="space-y-4">
          <a
            href={RECOVERY_APP_URL}
            className="block w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold py-4 rounded-lg transition-all"
          >
            Launch Recovery App Now
          </a>

          <Link
            href="/"
            className="block w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white py-3 rounded-lg transition-all"
          >
            Back to Home
          </Link>
        </div>

        <p className="text-zinc-600 text-xs mt-8">
          For authorized agents only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
