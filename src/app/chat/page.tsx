"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, Trash2, Reply, X } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<any>(null);
  const typingTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // THE REPLY ENGINE STATE
  const [replyingTo, setReplyingTo] = useState<any>(null);

  useEffect(() => {
    const fetchProfileAndMessages = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/");
      
      const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(userProfile);

      const { data: initialMessages, error } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (!error && initialMessages) setMessages(initialMessages);
    };
    
    fetchProfileAndMessages();
  }, [router]);

  useEffect(() => {
    if (!profile) return; 

    const channel = supabase.channel("global_chat", {
      config: { presence: { key: profile.id }, broadcast: { self: false } }
    });
    
    channelRef.current = channel;

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter(msg => msg.id !== payload.old.id));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activeUsers = Object.values(state).map((presences: any) => presences[0]);
        setOnlineUsers(activeUsers);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const user = payload.username;
        setTypingUsers(prev => prev.includes(user) ? prev : [...prev, user]);
        
        if (typingTimers.current[user]) clearTimeout(typingTimers.current[user]);
        typingTimers.current[user] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== user));
        }, 2000);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: profile.id, username: profile.username || "Anonymous" });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, replyingTo]); 

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { username: profile.username }
      });
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;
    
    const textToSend = newMessage;
    const replyData = replyingTo ? {
      reply_to_id: replyingTo.id,
      reply_to_username: replyingTo.username,
      reply_to_content: replyingTo.content
    } : {};

    setNewMessage(""); 
    setReplyingTo(null); // Clear the reply banner after sending
    
    await supabase.from("messages").insert({
      user_id: profile.id,
      username: profile.username || "Anonymous",
      content: textToSend,
      ...replyData
    });
  };

  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== msgId));
    await supabase.from("messages").delete().eq("id", msgId);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col h-screen">
      
      <div className="p-4 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900 shrink-0 z-10 pt-6">
        <button onClick={() => router.push("/feed")} className="hover:text-[#A3A7F0] transition"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold tracking-wider">Global Chat</h1>
      </div>

      <div className="bg-zinc-900/50 border-b border-zinc-800/50 px-4 py-2.5 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0 shadow-sm z-10 backdrop-blur-md">
        <div className="flex items-center gap-1.5 shrink-0 bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Online ({onlineUsers.length})
          </span>
        </div>
        
        <div className="flex gap-2 items-center">
          {onlineUsers.map(u => (
            <span key={u.id} className="text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 py-1 rounded-full flex items-center gap-1">
              <span className="text-zinc-500">@</span>{u.username}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 mt-10">It's quiet. Say something!</div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === profile?.id;
            const canDelete = isMe || profile?.role === 'admin';

            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                
                {/* Visual Reply Indicator above the bubble */}
                {msg.reply_to_username && (
                  <div className={`flex items-center gap-1.5 mb-1 text-xs text-zinc-400 opacity-80 ${isMe ? "mr-2" : "ml-2"}`}>
                    <Reply className="w-3 h-3 scale-x-[-1]" />
                    <span>Replying to <span className="font-bold text-[#A3A7F0]">@{msg.reply_to_username}</span></span>
                  </div>
                )}

                <div className="flex items-baseline gap-2 mb-1 px-1">
                  {isMe && <span className="text-[10px] text-zinc-500">{formatTime(msg.created_at)}</span>}
                  <span className="text-xs text-zinc-400 font-bold">@{msg.username}</span>
                  {!isMe && <span className="text-[10px] text-zinc-500">{formatTime(msg.created_at)}</span>}
                </div>

                <div className={`relative group flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* The Hover Buttons (Reply & Delete) */}
                  <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "mr-2" : "ml-2"}`}>
                    <button onClick={() => setReplyingTo(msg)} className="text-[#A3A7F0] hover:text-[#8e93e6] p-1.5 rounded-full hover:bg-zinc-800 transition" title="Reply">
                      <Reply className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      <button onClick={() => deleteMessage(msg.id)} className="text-red-500 hover:text-red-400 p-1.5 rounded-full hover:bg-zinc-800 transition" title="Delete message">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* The Message Bubble */}
                  <div className={`px-5 py-3 text-base max-w-[75vw] md:max-w-[60vw] break-words shadow-lg ${isMe ? "bg-[#A3A7F0] text-zinc-950 rounded-2xl rounded-tr-sm font-medium" : "bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm"}`}>
                    {/* If it's a reply, show a tiny preview of what they replied to inside the bubble */}
                    {msg.reply_to_content && (
                      <div className={`text-xs pl-2 mb-2 border-l-2 py-0.5 line-clamp-1 ${isMe ? "border-zinc-900/30 text-zinc-800" : "border-[#A3A7F0]/50 text-zinc-400"}`}>
                        {msg.reply_to_content}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0 fixed bottom-0 w-full left-0 z-10 flex flex-col">
        
        {/* THE REPLYING BANNER */}
        {replyingTo && (
          <div className="max-w-3xl mx-auto w-full mb-3 bg-zinc-900 border border-zinc-700/50 rounded-xl p-3 flex justify-between items-center shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-bold text-[#A3A7F0] flex items-center gap-1.5 mb-1">
                <Reply className="w-3 h-3 scale-x-[-1]" /> Replying to @{replyingTo.username}
              </div>
              <div className="text-sm text-zinc-400 truncate">{replyingTo.content}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-2 text-zinc-500 hover:text-white transition rounded-full hover:bg-zinc-800 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {typingUsers.length > 0 && !replyingTo && (
          <div className="text-xs text-[#A3A7F0] italic px-4 pb-2 animate-pulse font-medium tracking-wide max-w-3xl mx-auto w-full">
            {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 max-w-3xl mx-auto w-full">
          <input 
            type="text" 
            value={newMessage} 
            onChange={handleTyping} 
            placeholder="Type a message..." 
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-5 py-4 focus:outline-none focus:border-[#A3A7F0] transition shadow-inner text-base"
          />
          <button type="submit" disabled={!newMessage.trim()} className="bg-[#A3A7F0] hover:bg-[#8e93e6] text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-full transition flex items-center justify-center shadow-lg shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
