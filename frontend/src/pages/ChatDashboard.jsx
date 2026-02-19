import { useEffect, useLayoutEffect, useRef, useState } from "react";
import api from "../api/axios";
import { ACCESS_TOKEN } from "../constants";

/* ================= HELPERS ================= */


const normalizeFileUrl = (url) => {
  if (!url) return null;

  // already absolute
  if (url.startsWith("http")) return url;

  // backend already sends /media/...
  if (url.startsWith("/media/")) {
    return `http://127.0.0.1:8000${url}`;
  }

  // fallback: raw path (chat_files/xxx.png)
  return `http://127.0.0.1:8000/media/${url}`;
};


const isImageFile = (url) => {
  if (!url) return false;

  // ✅ sender-side preview
  if (url.startsWith("blob:")) return true;

  // ✅ uploaded images
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
};


const formatTime = (ts) =>
  ts
    ? new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const isNewDay = (curr, prev) =>
  curr && (!prev || new Date(curr).toDateString() !== new Date(prev).toDateString());

const formatDateLabel = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};


/* ================= COMPONENT ================= */


export default function ChatDashboard() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);

  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [users, setUsers] = useState([]);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");

  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const typingTimeout = useRef(null);
  const roomJustOpenedRef = useRef(false);
  const bottomRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const [showUsers, setShowUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");

  /* ================= CURRENT USER ================= */

  const token = localStorage.getItem(ACCESS_TOKEN);
let currentUserId = null;

if (token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    currentUserId = Number(payload?.user_id ?? null);
  } catch (e) {
    console.warn("Invalid JWT token");
  }
}

const openPrivateChat = async (userId) => {
  try {
    const res = await api.post("/chat/chat/private/", {
      user_id: userId,
    });

    // open the returned room
    openRoom(res.data);

    // add room to sidebar if not already present
    setRooms((prev) => {
      if (prev.some((r) => r.id === res.data.id)) return prev;
      return [res.data, ...prev];
    });
  } catch (err) {
    console.error("Private chat error", err);
  }
};

const goBackToList = () => {
  setActiveRoom(null);
  setMessages([]);
  setShowChat(false);
  socketRef.current?.close();
};

  /* ================= INIT ================= */



  const loadRooms = async () => {
    const res = await api.get("/chat/rooms/");
    setRooms(res.data);
  };
/* ================= INIT ================= */

useEffect(() => {
  loadRooms();
  return () => socketRef.current?.close();
}, []);

useEffect(() => {
  api.get("/chat/users/").then((res) => setUsers(res.data));
}, []);

useEffect(() => {
  if (!roomJustOpenedRef.current) return;
  if (!messages.length) return;

  requestAnimationFrame(() => {
    scrollToBottom(false);
    roomJustOpenedRef.current = false;
    shouldAutoScrollRef.current = true;
  });
}, [messages]);

useEffect(() => {
  if (!messages.length) return;

  if (shouldAutoScrollRef.current) {
    scrollToBottom(true);
  }
}, [messages]);

useEffect(() => {
  const imgs = containerRef.current?.querySelectorAll("img");

  imgs?.forEach((img) => {
    img.onload = () => {
      if (shouldAutoScrollRef.current) {
        scrollToBottom(false);
      }
    };
  });
}, [messages]);

  /* ================= ROOM ================= */

  const openRoom = async (room) => {
    setShowChat(true); 
    socketRef.current?.close();

    setActiveRoom(room);
    setMessages([]);
    setEditingId(null);
    setTypingUser("");
    setOnlineUsers([]);

    setRooms(prev =>
  prev.map(r =>
    r.id === room.id
      ? { ...r, unread_count: 0 }
      : r
  )
);

roomJustOpenedRef.current = true;
    const res = await api.get(`/chat/rooms/${room.id}/`);
   setMessages(
  (res.data.messages || []).map((m) => ({
    ...m,
    user: m.user
      ? m.user
      : { id: m.user_id, username: "Unknown" },
    reply_to: m.reply_to
      ? {
          ...m.reply_to,
          user: m.reply_to.user || { username: "Unknown" },
        }
      : null,
    file: normalizeFileUrl(m.file),
  }))
);

    const ws = new WebSocket(
      `ws://127.0.0.1:8000/ws/chat/${room.id}/?token=${token}`
    );
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  /* ================= MESSAGE ================= */
if (data.type === "message") {
  const msg = {
    ...data,
    user:
      typeof data.user === "string"
        ? { id: data.user_id, username: data.user }
        : data.user,
    file: normalizeFileUrl(data.file),
  };

  // ✅ update messages
  setMessages(prev => {
    if (data.client_id) {
      let replaced = false;
      const updated = prev.map(m => {
        if (m.client_id === data.client_id) {
          replaced = true;
          return { ...msg, client_id: null };
        }
        return m;
      });
      if (replaced) return updated;
    }

    if (prev.some(m => m.id === msg.id)) return prev;
    return [...prev, msg];
  });

  // ✅ update rooms (LIVE unread)
  setRooms(prev =>
    prev.map(room => {
      if (room.id !== data.room_id) return room;

      const isActive = activeRoom?.id === room.id;

      return {
        ...room,
        last_message: {
          message: data.message || "",
          file: data.file || null,
        },
        unread_count: isActive
          ? 0
          : (room.unread_count || 0) + 1,
      };
    })
  );

  return;
}

  /* ================= EDIT ================= */
  if (data.type === "edit") {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === data.id
          ? { ...m, message: data.message, edited: true }
          : m
      )
    );
    return;
  }

  /* ================= DELETE ================= */
  if (data.type === "delete") {
    setMessages((prev) => prev.filter((m) => m.id !== data.id));
    return;
  }

  /* ================= TYPING ================= */
  if (data.type === "typing") {
    setTypingUser(`${data.user.username} `);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTypingUser(""), 1500);
    return;
  }

  /* ================= STATUS ================= */
  if (data.type === "status") {
    setOnlineUsers((prev) =>
      data.status === "online"
        ? [...new Map([...prev, data.user].map((u) => [u.id, u])).values()]
        : prev.filter((u) => u.id !== data.user.id)
    );
  }
};

    socketRef.current = ws;
    requestAnimationFrame(() => scrollToBottom(false));
  };

  /* ================= AUTOSCROLL ================= */

  const scrollToBottom = (smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    try {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

// useEffect(() => {
//   if (!roomJustOpenedRef.current) return;
//   if (!messages.length) return;

//   // wait until DOM + images settle
//   setTimeout(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "auto" });
//     roomJustOpenedRef.current = false;
//   }, 50);
// }, [messages]);


  /* ================= SEND ================= */

  const sendMessage = () => {
    if (!text.trim() || !socketRef.current) return;

    const client_id = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${client_id}`,
        client_id,
        user: { id: currentUserId, username: "You" },
        user_id: currentUserId,
        message: text.trim(),
        created_at: new Date().toISOString(),
        edited: false,
        file: null,
      },
    ]);

    socketRef.current.send(
      JSON.stringify({
        type: "message",
        message: text.trim(),
        client_id,
      })
    );

    setText("");
  };

  /* ================= TYPING ================= */

  const handleTyping = (value) => {
    setText(value);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "typing" }));
    }
  };

  /* ================= FILE ================= */
const sendFile = async (file) => {
  const client_id = crypto.randomUUID();

  // 1️⃣ temp preview
  const preview = URL.createObjectURL(file);
  setMessages(prev => [
    ...prev,
    {
      id: `tmp-${client_id}`,
      client_id,
      user_id: currentUserId,
      user: { id: currentUserId, username: "You" },
      file: preview,
      message: "",
      created_at: new Date().toISOString(),
    }
  ]);

  // 2️⃣ upload
  const form = new FormData();
  form.append("file", file);

  const res = await api.post(
    `/chat/rooms/${activeRoom.id}/upload/`,
    form
  );

  // 3️⃣ WS message (🔥 REQUIRED)
  socketRef.current.send(JSON.stringify({
    type: "message",
    file: res.data.file,   // chat_files/xxx.png
    client_id
  }));
};


  /* ================= EDIT ================= */

 const saveEdit = (id) => {
  if (!socketRef.current || !editText.trim()) return;

  socketRef.current.send(
    JSON.stringify({
      type: "edit",
      id,
      message: editText.trim(),
    })
  );

  setEditingId(null);
  setEditText("");
};

  /* ================= DELETE ================= */

  const deleteMessage = (id) => {
    if (!window.confirm("Delete this message?")) return;

    setMessages((prev) => prev.filter((m) => m.id !== id));

    api.delete(`/chat/messages/${id}/delete/`);
    socketRef.current.send(JSON.stringify({ type: "delete", id }));
  };
const filteredUsers = users.filter((u) =>
  u.username.toLowerCase().includes(userSearch.toLowerCase())
);

const filteredRooms = rooms.filter((room) => {
  const title = room.is_private
    ? room.members.find((u) => u.id !== currentUserId)?.username
    : room.name;

  return title?.toLowerCase().includes(chatSearch.toLowerCase());
});

  /* ================= RENDER ================= */

 return (
<div className="container-fluid vh-100">
    <div className="row h-100 g-0 overflow-hidden">
      
      {/* ROOMS */}
{/* ROOMS + USERS */}
<div
  className={`col-12 col-md-3 border-end bg-light p-0 d-flex flex-column ${
    showChat ? "d-none d-md-flex" : ""
  }`} style={{ height: "100vh" }}
>
  {/* HEADER */}
  <div className="p-3 border-bottom bg-white">
   <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
  <h5 className="fw-bold mb-0">Chats</h5>

  <button
    className="btn btn-sm btn-primary rounded-circle"
    onClick={() => setShowUsers(true)}
  >
    +
  </button>
</div>


    {/* SEARCH */}
    <input
      className="form-control form-control-sm"
      placeholder="Search chats..."
       value={chatSearch}
  onChange={(e) => setChatSearch(e.target.value)}
    />
  </div>

  {/* ROOMS */}
  <div className="flex-grow-1 overflow-auto p-2" >
    {filteredRooms.map((room) => {
      const title = room.is_private
        ? room.members.find((u) => u.id !== currentUserId)?.username
        : room.name;

      return (
        <div
          key={room.id}
          onClick={() => openRoom(room)}
          className={`d-flex align-items-center gap-2 p-2 rounded mb-1 chat-item ${
            activeRoom?.id === room.id ? "active-chat" : ""
          }`}
          style={{ cursor: "pointer" }}
        >
          {/* AVATAR */}
          <div className="avatar-circle">
            {title?.[0]?.toUpperCase()}
          </div>

          {/* TEXT */}
          <div className="flex-grow-1">
            <div className="fw-semibold">{title}</div>
            <div className="small text-muted text-truncate">
  {room.last_message
    ? room.last_message.message
      ? room.last_message.message
      : room.last_message.file
      ? "📎 File"
      : ""
    : "No messages yet"}
</div>
{room.unread_count > 0 && (
  <span className="badge bg-primary rounded-pill ms-auto">
    {room.unread_count}
  </span>
)}

          </div>
        </div>
      );
    })}

    {/* USERS */}
   {/* USERS OVERLAY */}
{showUsers && (
  <div
    className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex"
    style={{ zIndex: 1050 }}
    onClick={() => setShowUsers(false)}
  >
    {/* PANEL */}
    <div
      className="bg-white h-100 p-3"
      style={{
        width: "100%",
        maxWidth: "360px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Select user</h6>
        <button
          className="btn btn-sm btn-light"
          onClick={() => setShowUsers(false)}
        >
          ✕
        </button>
      </div>

      {/* USERS LIST */}
{/* SEARCH INPUT */}
<input
  className="form-control form-control-sm mb-3"
  placeholder="Search users..."
  value={userSearch}
  onChange={(e) => setUserSearch(e.target.value)}
/>

{/* USERS LIST */}
{filteredUsers.length === 0 && (
  <div className="text-center small text-muted mt-3">
    No users found
  </div>
)}

{filteredRooms.length === 0 && (
  <div className="text-center small text-muted mt-4">
    No chats found
  </div>
)}

<div
  className="overflow-auto"
  style={{ maxHeight: "calc(100vh - 120px)" }}
>
  {filteredUsers.map((u) => (
    <div
      key={u.id}
      className="d-flex align-items-center gap-3 p-2 rounded user-item"
      style={{ cursor: "pointer" }}
      onClick={() => {
        openPrivateChat(u.id);
        setShowUsers(false);
        setUserSearch("");
      }}
    >
      <div className="avatar-circle">
        {u.username?.charAt(0).toUpperCase()}
      </div>

      <div className="fw-semibold">{u.username}</div>
    </div>
  ))}
</div>

    </div>
  </div>
)}
  </div>
</div>

      {/* CHAT */}
      <div
  className={`col-12 col-md-9 d-flex flex-column vh-100 ${
    !showChat ? "d-none d-md-flex" : ""
  }`}
>

        
        {/* HEADER */}
        
      <div className="border-bottom p-3 fw-bold d-flex align-items-center gap-2" >
  
  {/* BACK (mobile only) */}
  <button
    className="btn btn-sm btn-light d-md-none"
    onClick={goBackToList}
  >
    ←
  </button>

  <div>
    {activeRoom
      ? activeRoom.is_private
        ? activeRoom.members?.find(u => u.id !== currentUserId)?.username
        : activeRoom.name
      : "Select a chat"}

    <div className="small text-muted" >
      Online:{" "}
      {onlineUsers.length
        ? onlineUsers.map((u) => u.username).join(", ")
        : "—"}
    </div>
  </div>
</div>

        {/* MESSAGES */}
        <div className="flex-grow-1 p-3 overflow-auto" ref={containerRef}>
          {Array.isArray(messages) &&
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const isMine = m.user_id === currentUserId;

              return (
                <div key={m.id}>
                  {isNewDay(m.created_at, prev?.created_at) && (
                    <div className="text-center my-3">
                      <span className="px-3 py-1 bg-light border rounded small">
                        {formatDateLabel(m.created_at)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`d-flex mb-2 ${
                      isMine ? "justify-content-end" : ""
                    }`}
                  >
                    <div
                      className={`p-2 rounded ${
                        isMine ? "bg-primary text-white" : "bg-light"
                      }`}
                      style={{ maxWidth: "70%" }}
                    >
                      {!isMine && (
                        <div className="fw-bold small mb-1">
                          {m.user?.username || "Unknown"}
                        </div>
                      )}

                      {m.reply_to && (
                        <div className="small mb-1 p-1 bg-white bg-opacity-25 rounded">
                          <strong>{m.reply_to.user.username}:</strong>{" "}
                          {m.reply_to.message}
                        </div>
                      )}

                      {m.message && <div>{m.message}</div>}

                      {m.file && (
                        <div className="mt-1">
                          {isImageFile(m.file) ? (
                            <img
                              src={m.file}
                              alt="uploaded"
                              className="img-fluid rounded"
                              style={{ maxHeight: "220px" }}
                            />
                          ) : (
                            <a href={m.file} target="_blank" rel="noreferrer">
                              📎 Download file
                            </a>
                          )}
                        </div>
                      )}

                      {m.edited && (
                        <span className="ms-1 small">(edited)</span>
                      )}

                      <div className="small d-flex justify-content-end gap-2 mt-1">
                        {formatTime(m.created_at)}
                        {isMine && typeof m.id !== "string" && (
                          <>
                            <span
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setEditingId(m.id);
                                setEditText(m.message);
                              }}
                            >
                              ✏️
                            </span>
                            <span
                              style={{ cursor: "pointer" }}
                              onClick={() => deleteMessage(m.id)}
                            >
                              🗑
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={bottomRef} />
        </div>

        {/* TYPING INDICATOR */}
        {typingUser && (
          <div className="px-3 py-1 small text-muted fst-italic">
            {typingUser} is typing…
          </div>
        )}

        {/* INPUT BAR */}
        {activeRoom && (
          <form
 className="border-top p-2 d-flex gap-2 bg-white" style={{ position: "sticky", bottom: 0 }}


  onSubmit={(e) => {
    e.preventDefault();
    editingId ? saveEdit(editingId) : sendMessage();
  }}
>
  <input
    type="file"
    hidden
    ref={fileInputRef}
    onChange={(e) => sendFile(e.target.files[0])}
  />

  <button
    className="btn btn-light"
    type="button"
    onClick={() => fileInputRef.current.click()}
  >
    📎
  </button>

  <input
    className="form-control"
    value={editingId ? editText : text}
    placeholder={editingId ? "Edit message..." : "Type a message..."}
    onChange={(e) => {
      if (editingId) {
        setEditText(e.target.value);
      } else {
        handleTyping(e.target.value);
      }
    }}
  />

  {editingId && (
    <button
      type="button"
      className="btn btn-outline-secondary"
      onClick={() => {
        setEditingId(null);
        setEditText("");
      }}
    >
      Cancel
    </button>
  )}

  <button className="btn btn-primary">
    {editingId ? "Update" : "Send"}
  </button>
</form>

        )}
      </div>
    </div>
  </div>
)
}