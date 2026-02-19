import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Chat() {
  const [rooms, setRooms] = useState(null); // null = loading, [] = empty
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.get("chat/rooms/");
        setRooms(res.data);
      } catch (err) {
        console.error("Rooms fetch error:", err);
        // handle auth failure -> redirect to login
        if (err.response) {
          if (err.response.status === 401 || err.response.status === 403) {
            // token expired or missing -> clear and send to login
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            navigate("/", { replace: true });
            return;
          }
          setError(err.response.data || err.response.statusText);
        } else {
          setError("Network error");
        }
        setRooms([]); // show no rooms, but not blank screen
      }
    };

    fetchRooms();
  }, [navigate]);

  if (rooms === null) return <div className="p-4">Loading rooms…</div>;

  return (
    <div className="container mt-4">
      <h4>Your Chat Rooms</h4>

      {error && <div className="alert alert-danger">{String(error)}</div>}

      {rooms.length === 0 ? (
        <p>No rooms found. Create one in admin or ask admin to add you to a room.</p>
      ) : (
        <ul className="list-group">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="list-group-item list-group-item-action"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/chat/${room.id}`)}
            >
              {room.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
