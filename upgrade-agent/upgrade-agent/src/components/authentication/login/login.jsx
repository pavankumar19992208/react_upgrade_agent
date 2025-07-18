import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [response, setResponse] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSuccess(false);
    setResponse("Authenticating...");
    
    try {
      const loginRes = await axios.post(
        "https://package-upgrader.app.n8n.cloud/webhook-test/login",
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (loginRes.status === 200) {
        setIsSuccess(true);
        setResponse("Login successful! Redirecting...");
        
        // Redirect with username immediately
        navigate("/dashboard", { 
          state: { username } 
        });
      } else {
        throw new Error(loginRes.data?.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setIsSuccess(false);
      setResponse(err.response?.data?.message || "Login failed. Please try again.");
    }
  };

  return (
    <div style={{ maxWidth: 300, margin: "2rem auto", textAlign: "center" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button
          type="submit"
          style={{ width: "100%", padding: "0.5rem" }}
        >
          Login
        </button>
      </form>
      <p style={{ 
        marginTop: 12,
        color: isSuccess ? "green" : "red",
        fontWeight: isSuccess ? "bold" : "normal",
        minHeight: "24px"
      }}>
        {response}
      </p>
    </div>
  );
}