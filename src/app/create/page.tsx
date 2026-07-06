"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronLeft, Image as ImageIcon, Loader2, Send, BarChart2, Plus, X, Video } from "lucide-react";

export default function CreatePage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  // POLL STATE
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // MEDIA STATE
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
      else {
        setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        setUsername(profile?.username || user.user_metadata?.display_name || "Unknown");
      }
    };
    getUser();
  }, [router]);

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const addOption = () => {
    if (pollOptions.length < 5) setPollOptions([...pollOptions, ""]);
  };

  const removeOption = (index: number) => {
    if (pollOptions.length > 2) {
      const newOptions = [...pollOptions];
      newOptions.splice(index, 1);
      setPollOptions(newOptions);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handlePost = async () => {
    if (!content.trim() && !isPoll && !mediaFile) return;
    setLoading(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      // 1. Upload Media if it exists
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        
        // Note: Assuming your bucket is named 'media' or 'stories'. Adjust if your previous bucket was named differently!
        const { error: uploadError } = await supabase.storage.from('media').upload(fileName, mediaFile);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('media').getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }

      // 2. Create the Story
      const { data: story, error: storyError } = await supabase.from('stories').insert({
        author_id: userId,
        author_name: username,
        content: content,
        is_poll: isPoll,
        media_url: mediaUrl,
        media_type: mediaType
      }).select().single();

      if (storyError) throw storyError;

      // 3. Insert Poll Options if applicable
      if (isPoll && story) {
        const validOptions = pollOptions.filter(opt => opt.trim() !== "");
        if (validOptions.length >= 2) {
          const optionsToInsert = validOptions.map(opt => ({
            story_id: story.id,
            option_text: opt.trim()
          }));
          await supabase.from('poll_options').insert(optionsToInsert);
        }
      }

      router.push("/feed");
    } catch (error: any) {
      alert("Error creating post: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isPostDisabled = loading || (!content.trim() && !isPoll && !mediaFile) || (isPoll && pollOptions.filter(o => o.trim()).length < 2);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-xl mx-auto pt-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/feed")} className="hover:text-blue-400 transition"><ChevronLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-bold tracking-wide">Create</h1>
          </div>
          <button onClick={handlePost} disabled={isPostDisabled} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-full font-bold transition flex items-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Post</>}
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            placeholder={isPoll ? "Ask a question..." : "What's on your mind?"}
            className="w-full bg-transparent text-white text-lg focus:outline-none resize-none min-h-[120px]"
          />

          {/* MEDIA PREVIEW */}
          {mediaPreview && (
            <div className="relative mt-4 rounded-xl overflow-hidden bg-black border border-zinc-800">
              <button onClick={clearMedia} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition z-10">
                <X className="w-5 h-5" />
              </button>
              {mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} controls className="max-h-64 w-full object-contain" />
              ) : (
                <img src={mediaPreview} alt="Preview" className="max-h-64 w-full object-contain" />
              )}
            </div>
          )}

          {/* POLL BUILDER UI */}
          {isPoll && (
            <div className="mt-4 space-y-3 bg-black/50 p-4 rounded-2xl border border-zinc-800">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2"><BarChart2 className="w-4 h-4"/> Poll Options</h3>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={opt} 
                    onChange={(e) => updatePollOption(idx, e.target.value)} 
                    placeholder={`Option ${idx + 1}`} 
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => removeOption(idx)} className="p-3 text-zinc-500 hover:text-red-500 transition bg-zinc-900 rounded-xl border border-zinc-700">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button onClick={addOption} className="text-blue-500 text-sm font-bold flex items-center gap-1 mt-2 hover:text-blue-400 p-2">
                  <Plus className="w-4 h-4" /> Add Option
                </button>
              )}
            </div>
          )}

          {/* COMPACT ATTACHMENT BAR */}
          <div className="flex gap-2 md:gap-4 mt-6 pt-6 border-t border-zinc-800/50 flex-wrap">
            <button onClick={() => setIsPoll(!isPoll)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition font-bold text-sm ${isPoll ? 'bg-blue-600/20 text-blue-500 border border-blue-500/30' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent'}`}>
              <BarChart2 className="w-5 h-5" /> {isPoll ? "Remove Poll" : "Add Poll"}
            </button>

            <label className="flex items-center gap-2 px-4 py-2 rounded-xl transition font-bold text-sm cursor-pointer text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent">
              <ImageIcon className="w-5 h-5" /> Add Media
              <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
