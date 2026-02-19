export default function ChatWindow() {
  return (
    <div className="h-100 d-flex flex-column">

      {/* HEADER */}
      <div className="p-3 border-bottom fw-bold">
        Marketing Team
      </div>

      {/* MESSAGES */}
      <div className="flex-grow-1 overflow-auto p-3 bg-light">
        <div className="mb-3">
          <div className="bg-white p-3 rounded w-75">
            Perfect! This helps a lot.
          </div>
        </div>

        <div className="mb-3 text-end">
          <div className="bg-primary text-white p-3 rounded d-inline-block w-75">
            Here is the updated timeline.
          </div>
        </div>
      </div>

      {/* INPUT */}
      <div className="p-3 border-top d-flex">
        <input
          className="form-control me-2"
          placeholder="Type a message..."
        />
        <button className="btn btn-primary">➤</button>
      </div>

    </div>
  );
}
