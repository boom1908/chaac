"use client";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, User, LogOut, Edit2, Check, X, Camera, Key, Loader2, ShieldAlert, BadgeCheck } from "lucide-react";

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUid = searchParams.get("uid");

  const [profile, setProfile] = useState<any>(null);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/");
      setUserId(user.id);

      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (myProfile?.role === 'admin') setIsAdmin(true);

      const targetUserId = urlUid || user.id;
      setIsMyProfile(targetUserId === user.id);

      // Fetch Profile and Stories
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
      const { data: stories } = await supabase.from('stories').select('*, likes(user_id)').eq('author_id', targetUserId).order('created_at', { ascending: false });
      
      const loadedStories = stories || [];
      setUserStories(loadedStories);

      // THE AUTO-VERIFICATION SCANNER
      const currentLikes = loadedStories.reduce((acc, story) => acc + (story.likes_count || 0), 0);
      const legacyLikes = profileData?.legacy_likes || 0;
      const totalLikes = currentLikes + legacyLikes;
      let verifiedStatus = profileData?.is_verified;

      if (!verifiedStatus && totalLikes >= 100) {
        // Silently upgrade them to verified in the database
        await supabase.from('profiles').update({ is_verified: true }).eq('id', targetUserId);
        verifiedStatus = true;
      }

      setProfile({ ...(profileData || { username: isMyProfile ? user.user_metadata?.display_name : "Unknown User" }), is_verified: verifiedStatus });
      
      setEditUsername(profileData?.username || "");
      setEditBio(profileData?.bio || "");
      setEditAvatar(profileData?.avatar_url || "");
      setLoading(false);
    };
    fetchProfile();
  }, [router, urlUid]);

  const uploadAvatar = async (event: any) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('You must select an image to upload.');
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setEditAvatar(data.publicUrl);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!userId || !editUsername.trim()) return;
    await supabase.from('profiles').upsert({ id: userId, username: editUsername.trim(), bio: editBio, avatar_url: editAvatar });
    setProfile({ ...profile, id: userId, username: editUsername.trim(), bio: editBio, avatar_url: editAvatar });
    setIsEditing(false);
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) return alert("Password must be at least 6 characters.");
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else { alert("Password updated securely!"); setNewPassword(""); }
    setPasswordLoading(false);
  };

  const executeBan = async () => {
    if (confirm(`ADMIN OVERRIDE: Are you sure you want to permanently ban @${profile?.username}?`)) {
      await supabase.from('profiles').update({ is_banned: true }).eq('id', profile.id);
      alert(`@${profile?.username} has been eliminated from the matrix.`);
      router.push("/feed");
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex justify-center items-center">Loading...</div>;

  const totalLikes = userStories.reduce((acc, story) => acc + (story.likes_count || 0), 0) + (profile?.legacy_likes || 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 pb-20">
      <div className="max-w-xl mx-auto pt-4">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/feed")} className="hover:text-blue-400 transition"><ChevronLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
              @{profile?.username}
              {(profile?.is_verified || profile?.role === 'admin') && <BadgeCheck className="w-6 h-6 text-blue-500 fill-blue-500/20" title="Verified User" />}
            </h1>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 px-2">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0 relative">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-zinc-500" />}
          </div>
          
          <div className="flex gap-6 text-center flex-1 justify-center">
            <div>
              <p className="text-xl font-bold">{userStories.length}</p>
              <p className="text-xs text-zinc-400">Posts</p>
            </div>
            <div className="relative group cursor-help">
              <p className="text-xl font-bold flex items-center justify-center gap-1">{totalLikes}</p>
              <p className="text-xs text-zinc-400">Likes</p>
            </div>
          </div>
        </div>

        <div className="px-2 mb-6">
          {profile?.is_banned && <div className="bg-red-900/40 border border-red-500/50 text-red-500 text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 uppercase tracking-wider">User Banned</div>}
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{profile?.bio || "No bio yet."}</p>
        </div>

        {isAdmin && !isMyProfile && !profile?.is_banned && (
          <button onClick={executeBan} className="w-full bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-900/40 hover:border-red-500/60 font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 mb-8 shadow-lg">
            <ShieldAlert className="w-5 h-5" /> Ban & Terminate Profile
          </button>
        )}

        {isMyProfile && (
          !isEditing ? (
            <div className="flex gap-2 mb-8">
              <button onClick={() => setIsEditing(true)} className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold py-2 rounded-lg text-sm transition flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" /> Edit profile
              </button>
              <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-red-500 font-bold p-2 rounded-lg transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Edit Profile</h3>
                <button onClick={() => {setIsEditing(false); setEditAvatar(profile?.avatar_url); setEditBio(profile?.bio); setEditUsername(profile?.username);}} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-2 uppercase tracking-wider">Profile Picture</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                     {editAvatar ? <img src={editAvatar} className="w-full h-full object-cover" /> : <User className="w-8 h-8 m-4 text-zinc-500" />}
                  </div>
                  <label className="flex-1 cursor-pointer bg-black border border-zinc-700 hover:border-blue-500 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" /> <span>Upload Image</span></>}
                    <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-2 uppercase tracking-wider">Username</label>
                <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition" placeholder="Your username" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-2 uppercase tracking-wider">Bio</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none transition" rows={3} placeholder="Write something..." />
              </div>

              <button onClick={saveProfile} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 shadow-lg">
                <Check className="w-5 h-5" /> Save Profile
              </button>
              
              <hr className="border-zinc-800/50 my-6" />

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-2 uppercase tracking-wider text-red-400">Security / Password</label>
                <div className="flex gap-2">
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (min 6 chars)" className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition" />
                  <button onClick={updatePassword} disabled={passwordLoading} className="bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-900/40 hover:border-red-500/60 px-4 rounded-xl font-bold transition flex items-center justify-center shadow-md">
                    {passwordLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                  </button>
                </div>
              </div>

            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white flex justify-center items-center">Loading Profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
