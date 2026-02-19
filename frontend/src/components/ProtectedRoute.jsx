import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN } from "../constants";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem(ACCESS_TOKEN);
  if (!token) return <Navigate to="/" />;
  return children;
}
