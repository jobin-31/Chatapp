import { useEffect, useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("chat/rooms/")
      .then(res => setRooms(res.data))
      .catch(err => console.log(err));
      
  }, []);

  return (
    <div className="h-100">
      <h5 className="p-3 border-bottom">Messages</h5>

      {rooms.map(room => (
        <div
          key={room.id}
          className="p-3 border-bottom chat-item"
          onClick={() => navigate(`/chat/${room.id}`)}
          style={{ cursor: "pointer" }}
        >
          <strong>{room.name}</strong>
        </div>
      ))}
    </div>
  );
}
