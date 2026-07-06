"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push("/feed");
    };
    checkSession();
  }, [router]);

  const handleAuth = async (e: React.FormEvent, type: "login" | "signup") => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const email = `${username.toLowerCase()}@chaac.local`;
    
    if (type === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: username.toLowerCase() } }
      });
      if (signUpError) setError(signUpError.message);
      else router.push("/feed");
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid credentials.");
      } else if (data?.user) {
        // THE ADMIN BOUNCER CHECK
        const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', data.user.id).single();
        
        if (profile?.is_banned) {
          await supabase.auth.signOut(); // Kick them back out instantly
          setError("you got banned by admin");
        } else {
          router.push("/feed");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
        <ShieldAlert className="w-8 h-8 text-blue-500 mx-auto mb-2" />
        <h2 className="text-white font-bold text-lg mb-2 tracking-widest uppercase">CHAAC VERSION 2</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Welcome to the upgraded servers. The feed has been wiped clean, but your accounts, bios, and likes have been saved.
        </p>
        <a href="https://v1chaac.vercel.app" target="_blank" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-bold py-2 px-6 rounded-full text-sm transition-all duration-300">
          Visit V1 Archive →
        </a>
      </div>

      <div className="w-full max-w-sm mb-12 text-center">
        <img src="/CHAAC.svg" alt="CHAAC" className="h-12 mx-auto mb-4" />
        <p className="text-zinc-500 text-sm tracking-widest uppercase">Where chaos becomes legend.</p>
      </div>

      <form className="w-full max-w-sm bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        {error && <div className="bg-red-900/40 border border-red-500/50 text-red-500 text-sm p-4 rounded-xl mb-6 text-center font-bold tracking-wide uppercase">{error}</div>}
        
        <div className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" required />
          
          <div className="flex gap-4 pt-4">
            <button onClick={(e) => handleAuth(e, "login")} disabled={loading} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
            </button>
            <button onClick={(e) => handleAuth(e, "signup")} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center">
              Sign Up
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
