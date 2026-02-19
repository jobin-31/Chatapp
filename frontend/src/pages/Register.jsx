import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios"; // Axios instance
import { Toast, ToastContainer } from "react-bootstrap";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: "", success: true });

  const showToast = (msg, success = true) => setToast({ show: true, msg, success });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async () => {
    if (!form.password || form.password !== form.confirmPassword) return showToast("Passwords do not match", false);
    if (!form.terms) return showToast("Accept Terms & Conditions", false);

    try {
      setLoading(true);
     await axios.post("/register/", {
  username: form.username,  // IMPORTANT
  email: form.email,
  password: form.password,
});

      showToast("Account created successfully!", true);
      setTimeout(() => navigate("/"), 1500); // Navigate to Login page
    } catch (err) {
      showToast("Registration failed", false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row align-items-center">

          {/* LEFT FORM */}
          <div className="col-lg-6 mb-4 mb-lg-0">
            <div className="bg-white p-5 rounded-4 shadow-sm">

              <h3 className="fw-bold mb-4">Join ChatConnect</h3>

              <input
                className="form-control mb-3"
                placeholder="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
              />

              <input
                className="form-control mb-3"
                placeholder="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />

              <input
                type="password"
                className="form-control mb-3"
                placeholder="Password"
                name="password"
                value={form.password}
                onChange={handleChange}
              />

              <input
                type="password"
                className="form-control mb-3"
                placeholder="Confirm Password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
              />

              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="terms"
                  checked={form.terms}
                  onChange={handleChange}
                />
                <label className="form-check-label">
                  I agree to the <span className="text-primary">Terms & Conditions</span>
                </label>
              </div>

              <button
                className="btn btn-primary w-100 mb-3"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>

              {/* ✅ Already have account */}
              <div className="text-center">
                <span className="text-muted">Already have an account? </span>
                <button
                  className="btn btn-link p-0"
                  onClick={() => navigate("/")}
                >
                  Login here
                </button>
              </div>

            </div>
          </div>

          {/* RIGHT INFO */}
          <div className="col-lg-6 ps-lg-5">
            <h2 className="fw-bold mb-3">Why Choose ChatConnect?</h2>
            <p className="text-muted mb-4">
              Real-time messaging, secure conversations, and group chat features.
            </p>
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
