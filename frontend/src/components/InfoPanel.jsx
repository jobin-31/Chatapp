export default function InfoPanel({ members = [] }) {
  return (
    <div className="p-3">
      <h6>Members</h6>
      {members.map((m, i) => (
        <div key={i}>{m.username}</div>
      ))}
    </div>
  );
}
