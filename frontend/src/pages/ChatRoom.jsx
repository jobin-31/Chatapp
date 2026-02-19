import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "../api/axios";

export default function ChatRoom() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axios.get(`chat/rooms/${roomId}/`)
      .then(res => setRoom(res.data))
      .catch(err => console.error(err));
  }, [roomId]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await axios.post(`chat/rooms/${roomId}/send/`, {
      content: message
    });

    setMessage("");

    const res = await axios.get(`chat/rooms/${roomId}/`);
    setRoom(res.data);
  };

  if (!room) return <p className="m-4">Loading...</p>;

  return (
    <div className="container mt-4">
      <h4>{room.name}</h4>

      <div className="mb-3">
        <strong>Members:</strong>{" "}
        {room.members.map(m => m.username).join(", ")}
      </div>

      <div className="border p-3 mb-3" style={{ height: "300px", overflowY: "auto" }}>
        {room.messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.sender.username}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div className="d-flex">
        <input
          className="form-control me-2"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type a message"
        />
        <button className="btn btn-primary" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
