"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus, User, LogOut, Heart, Share, Edit3, Trash2, Search, ShieldAlert, Bell, Pin, BarChart2, BadgeCheck } from "lucide-react";

export default function FeedPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    let radarChannel: any; 
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
        if (profile?.role === 'admin') setIsAdmin(true);

        radarChannel = supabase.channel("global_chat", { config: { presence: { key: user.id } } });
        radarChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await radarChannel.track({ id: user.id, username: profile?.username || "Anonymous" });
          }
        });
      }
    };
    getUser();
    return () => { if (radarChannel) supabase.removeChannel(radarChannel); };
  }, [router]);

  const fetchStoriesAndNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    
    // FETCH THE NEW VERIFICATION STATUS
    const { data: storiesData } = await supabase.from('stories').select('*, likes(user_id), comments(*), poll_options(*, poll_votes(user_id))');
    const { data: profilesData } = await supabase.from('profiles').select('id, avatar_url, role, is_verified');

    if (storiesData) {
      const mergedStories = storiesData.map(story => {
        const authorProfile = profilesData?.find(p => p.id === story.author_id);
        return { 
          ...story, 
          author_avatar: authorProfile?.avatar_url,
          author_is_verified: authorProfile?.is_verified,
          author_role: authorProfile?.role
        };
      });
      
      const sortedData = mergedStories.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setStories(sortedData);
    }

    if (currentUser) {
      const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
      if (notifs) setNotifications(notifs);
    }
    
    if (!silent) setLoading(false);
  };

  useEffect(() => { if (currentUser) fetchStoriesAndNotifications(); }, [currentUser]);

  const handleVote = async (optionId: string, storyId: string) => {
    try {
      await supabase.from('poll_votes').insert({ option_id: optionId, user_id: currentUser.id, story_id: storyId });
      fetchStoriesAndNotifications(true);
    } catch (error) {
      console.log("Already voted or error");
    }
  };

  const markNotificationsRead = async () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const handleLike = async (story: any) => {
    const hasLiked = story.likes.some((l: any) => l.user_id === currentUser.id);
    if (hasLiked) {
      await supabase.from('likes').delete().match({ story_id: story.id, user_id: currentUser.id });
      await supabase.from('stories').update({ likes_count: story.likes_count - 1 }).eq('id', story.id);
    } else {
      await supabase.from('likes').insert({ story_id: story.id, user_id: currentUser.id });
      await supabase.from('stories').update({ likes_count: story.likes_count + 1 }).eq('id', story.id);
      if (story.author_id !== currentUser.id) {
        await supabase.from('notifications').insert({ user_id: story.author_id, actor_name: currentUser.user_metadata.display_name, action_type: 'liked', story_id: story.id });
      }
    }
    fetchStoriesAndNotifications(true); 
  };

  const handleAddComment = async (storyId: string, authorId: string) => {
    if (!commentText.trim()) return;
    await supabase.from('comments').insert({ story_id: storyId, author_name: currentUser.user_metadata.display_name || "Unknown", content: commentText });
    if (authorId !== currentUser.id) {
      await supabase.from('notifications').insert({ user_id: authorId, actor_name: currentUser.user_metadata.display_name, action_type: 'commented on', story_id: storyId });
    }
    setCommentText("");
    fetchStoriesAndNotifications(true); 
  };

  const handlePin = async (storyId: string, currentPinStatus: boolean) => {
    await supabase.from('stories').update({ is_pinned: !currentPinStatus }).eq('id', storyId);
    fetchStoriesAndNotifications(true);
  };

  const handleDelete = async (storyId: string) => {
    if (confirm(isAdmin ? "ADMIN OVERRIDE: Delete this post?" : "Delete this post?")) {
      await supabase.from('stories').delete().eq('id', storyId);
      fetchStoriesAndNotifications();
    }
  };

  const saveEdit = async (storyId: string) => {
    await supabase.from('stories').update({ content: editContent }).eq('id', storyId);
    setEditingId(null);
    fetchStoriesAndNotifications(true);
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    fetchStoriesAndNotifications(true);
  };

  const filteredStories = stories.filter(story => 
    story.author_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (story.content && story.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!currentUser) return <div className="min-h-screen bg-zinc-950 flex justify-center items-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      
      <nav className="border-b border-zinc-800 p-4 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center px-4 relative">
          <img src="/CHAAC.svg" alt="CHAAC Logo" className="h-8 cursor-pointer hover:opacity-80 transition" onClick={() => fetchStoriesAndNotifications()} />
          <div className="flex gap-5 md:gap-6 items-center text-blue-400">
            {isAdmin && <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse hidden md:block" title="Admin Mode" />}
            
            <div className="relative">
              <button onClick={markNotificationsRead} className="hover:text-white transition relative">
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2">
                  <div className="p-3 border-b border-zinc-800 bg-zinc-950 font-bold text-sm text-zinc-300">Notifications</div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500 text-sm">All caught up!</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-3 border-b border-zinc-800/50 text-sm flex gap-2 items-start ${!n.is_read ? 'bg-blue-900/10' : ''}`}>
                           <div className="w-2 h-2 mt-1.5 rounded-full shrink-0 bg-blue-500"></div>
                           <p className="text-zinc-300"><span className="font-bold text-white">@{n.actor_name}</span> {n.action_type} your post.</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => router.push("/create")} className="hover:text-white transition"><Plus className="w-6 h-6" /></button>
            <button onClick={() => router.push("/chat")} className="hover:text-white transition"><MessageCircle className="w-6 h-6" /></button>
            <button onClick={() => router.push("/profile")} className="hover:text-white transition"><User className="w-6 h-6" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto mt-8 px-4 space-y-8 relative z-0">
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search users or chaos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition shadow-lg"
          />
        </div>

        {loading ? (<p className="text-center text-zinc-500 mt-10">Loading feed...</p>) : filteredStories.length === 0 ? (
          <div className="text-center p-8 bg-zinc-900 rounded-2xl">
             <p className="text-zinc-400">No stories found.</p>
          </div>
        ) : (
          filteredStories.map((story) => {
            const isAuthor = currentUser.id === story.author_id;
            const canManage = isAuthor || isAdmin; 
            const hasLiked = story.likes.some((l: any) => l.user_id === currentUser.id);

            let totalVotes = 0;
            let hasVoted = false;
            if (story.is_poll && story.poll_options) {
              totalVotes = story.poll_options.reduce((sum: number, opt: any) => sum + (opt.poll_votes?.length || 0), 0);
              hasVoted = story.poll_options.some((opt: any) => opt.poll_votes?.some((v: any) => v.user_id === currentUser.id));
            }

            return (
              <div key={story.id} className={`bg-zinc-900 border ${story.is_pinned ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : (isAdmin && !isAuthor ? 'border-red-900/50' : 'border-zinc-800/50')} rounded-2xl p-6 shadow-2xl relative`}>
                
                {story.is_pinned && (
                  <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Pin className="w-3 h-3" /> Pinned
                  </div>
                )}

                <div className="flex justify-between items-start mb-4 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center cursor-pointer shrink-0" onClick={() => router.push(`/profile?uid=${story.author_id}`)}>
                      {story.author_avatar ? <img src={story.author_avatar} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-blue-500 uppercase">{story.author_name.charAt(0)}</span>}
                    </div>
                    
                    {/* THE GLOWING VERIFICATION BADGE */}
                    <p className="font-bold text-blue-500 cursor-pointer hover:underline tracking-wide flex items-center gap-1" onClick={() => router.push(`/profile?uid=${story.author_id}`)}>
                      @{story.author_name}
                      {(story.author_is_verified || story.author_role === 'admin') && (
                        <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/20" title="Verified User" />
                      )}
                    </p>

                  </div>
                  {canManage && (
                    <div className="flex gap-3 text-zinc-600 mt-2">
                      {isAdmin && (
                        <button onClick={() => handlePin(story.id, story.is_pinned)} className={`hover:text-blue-400 ${story.is_pinned ? 'text-blue-500' : ''}`} title="Pin Post/Poll">
                          <Pin className="w-4 h-4" />
                        </button>
                      )}
                      {!story.is_poll && <button onClick={() => { setEditingId(story.id); setEditContent(story.content); }} className="hover:text-blue-400"><Edit3 className="w-4 h-4" /></button>}
                      <button onClick={() => handleDelete(story.id)} className="hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {editingId === story.id ? (
                  <div className="space-y-3 mb-4">
                    <textarea className="w-full h-32 bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none resize-none" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(story.id)} className="bg-blue-600 px-4 py-1.5 rounded-full text-sm font-semibold">Save</button>
                      <button onClick={() => setEditingId(null)} className="bg-zinc-700 px-4 py-1.5 rounded-full text-sm font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  story.content && <p className="text-zinc-300 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap font-medium">{story.content}</p>
                )}

                {story.media_url && (
                  <div className="rounded-xl overflow-hidden bg-black flex justify-center mb-4 border border-zinc-800/50">
                    {story.media_type === 'video' ? (
                      <video src={story.media_url} controls className="max-h-[500px] w-full object-contain" />
                    ) : (
                      <img src={story.media_url} alt="Post media" className="max-h-[500px] w-full object-contain" />
                    )}
                  </div>
                )}

                {story.is_poll && story.poll_options && (
                  <div className="bg-black/40 border border-zinc-800/50 rounded-2xl p-4 mb-4">
                    <div className="flex justify-between items-center mb-4 text-xs font-bold text-zinc-500 tracking-wider uppercase">
                      <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4"/> Community Poll</span>
                      <span>{totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'} Total</span>
                    </div>
                    
                    <div className="space-y-3">
                      {story.poll_options.map((opt: any) => {
                        const optVotes = opt.poll_votes?.length || 0;
                        const percentage = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                        const iVotedForThis = opt.poll_votes?.some((v: any) => v.user_id === currentUser.id);

                        return (
                          <div key={opt.id} className="relative group">
                            {hasVoted ? (
                              <div className="relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-xl h-12 flex items-center px-4">
                                <div className={`absolute left-0 top-0 h-full transition-all duration-1000 ease-out ${iVotedForThis ? 'bg-blue-600/30' : 'bg-zinc-800/50'}`} style={{ width: `${percentage}%` }}></div>
                                <div className="relative z-10 flex justify-between w-full text-sm font-medium">
                                  <span className={iVotedForThis ? 'text-blue-400 font-bold' : 'text-zinc-300'}>{opt.option_text} {iVotedForThis && '✓'}</span>
                                  <span className="text-zinc-400">{percentage}%</span>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => handleVote(opt.id, story.id)} className="w-full text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500 rounded-xl h-12 px-4 text-sm font-medium transition text-zinc-300">
                                {opt.option_text}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6 mt-2">
                  <button onClick={() => handleLike(story)} className={`flex items-center gap-2 transition group ${hasLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}>
                    <Heart className={`w-[22px] h-[22px] ${hasLiked ? 'fill-red-500' : 'group-hover:fill-red-500'}`} /> 
                    <span className="text-sm font-medium">{story.likes_count}</span> 
                  </button>
                  <button onClick={() => setActiveCommentPost(activeCommentPost === story.id ? null : story.id)} className={`flex items-center gap-2 transition ${activeCommentPost === story.id ? 'text-blue-400' : 'text-zinc-500 hover:text-blue-400'}`}>
                    <MessageCircle className="w-[22px] h-[22px]" /> 
                    <span className="text-sm font-medium">{story.comments?.length || 0}</span> 
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/feed?story=${story.id}`); alert("Link copied!"); }} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition">
                    <Share className="w-[22px] h-[22px]" /> 
                  </button>
                </div>

                {activeCommentPost === story.id && (
                  <div className="mt-5 pt-5 border-t border-zinc-800/50 space-y-4">
                    {story.comments && story.comments.map((c: any) => {
                      const canManageComment = currentUser.user_metadata.display_name === c.author_name || isAdmin; 
                      return (
                        <div key={c.id} className="flex gap-2 items-center group/comment">
                          <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-2xl p-3 text-sm flex-1 flex justify-between items-start">
                            <div>
                              <p className="font-bold text-xs text-blue-400 mb-1">@{c.author_name}</p>
                              <p className="text-zinc-300 break-words">{c.content}</p>
                            </div>
                            {canManageComment && (
                              <button onClick={() => handleDeleteComment(c.id)} className="text-zinc-600 hover:text-red-500 transition opacity-0 group-hover/comment:opacity-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex gap-2 items-center mt-2">
                      <input 
                        type="text" 
                        value={commentText} 
                        onChange={(e) => setCommentText(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(story.id, story.author_id); }} 
                        placeholder="Add a comment..." 
                        className="flex-1 bg-black border border-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-white" 
                      />
                      <button onClick={() => handleAddComment(story.id, story.author_id)} disabled={!commentText.trim()} className="text-blue-500 font-bold text-sm px-3 hover:text-blue-400 disabled:opacity-50">Post</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
