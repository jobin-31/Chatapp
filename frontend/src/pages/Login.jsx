import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../api/axios"; // Axios instance with JWT support
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { Toast, ToastContainer } from "react-bootstrap";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: "", success: true });

  const showToast = (msg, success = true) => {
    setToast({ show: true, msg, success });
  };

  const handleLogin = async () => {
    if (!email || !password) return showToast("Please enter email and password", false);

    try {
      setLoading(true);

      // POST to JWT login endpoint
     const res = await axios.post("token/", {
  username: email.trim(),   // SimpleJWT expects "username"
  password: password
});


      // Save JWT tokens
      localStorage.setItem(ACCESS_TOKEN, res.data.access);
      localStorage.setItem(REFRESH_TOKEN, res.data.refresh);

      showToast("Login successful!", true);

      setTimeout(() => navigate("/chat"), 1000); // redirect after login
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        const messages = Object.values(err.response.data).flat().join(" ");
        showToast(messages || "Login failed", false);
      } else {
        showToast("Login failed", false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 bg-light d-flex align-items-center">
      <div className="container">
        <div className="row align-items-center">

          {/* LEFT CARD */}
          <div className="col-lg-5 mb-4 mb-lg-0">
            <div className="bg-white p-5 rounded-4 shadow-sm">

              {/* Logo */}
              <div className="text-center mb-4">
                <div className="mb-3 fs-2 text-primary">💬</div>
                <h3 className="fw-bold">Welcome Back</h3>
                <p className="text-muted">
                  Sign in to continue your conversations and stay connected
                </p>
              </div>

              {/* Status */}
              <div className="text-success mb-3 small">
                ● Connected 📶
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="form-label fw-semibold">
                Username <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control form-control-lg"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  className="form-control form-control-lg"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Remember / Forgot */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="remember"
                  />
                  <label className="form-check-label" htmlFor="remember">
                    Remember Me
                  </label>
                </div>

                <Link to="#" className="text-primary text-decoration-none">
                  Forgot Password?
                </Link>
              </div>

              {/* Sign In */}
              <button
                className="btn btn-primary btn-lg w-100 mb-3"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In →"}
              </button>

              {/* Register Button */}
              <button
                className="btn btn-outline-primary btn-lg w-100"
                onClick={() => navigate("/register")}
              >
                Create New Account
              </button>

            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div className="col-lg-7 ps-lg-5">
            <h2 className="fw-bold mb-3">
              Connect Instantly, Chat Securely
            </h2>
            <p className="text-muted mb-4">
              Experience seamless real-time messaging with enterprise-grade
              security and intuitive features designed for modern communication.
            </p>

            <div className="row g-4">
              <Feature title="Real-time Messaging" desc="Instant message delivery with low latency" />
              <Feature title="End-to-End Encryption" desc="Your conversations are private and secure" />
              <Feature title="Group Chats" desc="Create and manage group conversations" />
              <Feature title="Media Sharing" desc="Share photos, videos, and files instantly" />
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      <ToastContainer position="top-end" className="p-3">
        <Toast
          bg={toast.success ? "success" : "danger"}
          show={toast.show}
          delay={3000}
          autohide
          onClose={() => setToast({ ...toast, show: false })}
        >
          <Toast.Body className="text-white">{toast.msg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="col-md-6">
      <div className="bg-white p-4 rounded-4 shadow-sm h-100">
        <h6 className="fw-semibold mb-1">{title}</h6>
        <p className="text-muted mb-0 small">{desc}</p>
      </div>
    </div>
  );
}
