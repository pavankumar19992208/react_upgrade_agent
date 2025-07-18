import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

// Response validation function
const validateDashboardData = (data) => {
  return (
    data &&
    typeof data === 'object' &&
    data.success === true &&
    Array.isArray(data.recentActions) &&
    typeof data.username === 'string'
  );
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const username = location.state?.username || sessionStorage.getItem("username");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("https://package-upgrader.app.n8n.cloud/webhook-test/dashboard", {
        params: { 
          username,
          _: Date.now() // Cache buster
        },
        timeout: 5000
      });

      console.log("API Response:", res.data); // Debug log

      if (!validateDashboardData(res.data)) {
        throw new Error(`Invalid data format: ${JSON.stringify(res.data)}`);
      }

      setDashboardData({
        username: res.data.username,
        recentActions: res.data.recentActions
      });
      setRetryCount(0); // Reset retry counter on success

    } catch (err) {
      console.error("API Error:", err);
      
      // Only update state if this is the first error or we've retried
      if (retryCount === 0 || retryCount >= 3) {
        setDashboardData({
          username,
          recentActions: [
            "System is processing your request",
            "Data may take a moment to load",
            `Last update attempt: ${new Date().toLocaleTimeString()}`
          ]
        });
      }
      
      if (retryCount < 3) {
        setRetryCount(c => c + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    sessionStorage.setItem("username", username);
    fetchData();
  }, [username, navigate]);

  // Auto-retry logic
  useEffect(() => {
    if (retryCount > 0 && retryCount < 3) {
      const retryTimer = setTimeout(fetchData, 2000);
      return () => clearTimeout(retryTimer);
    }
  }, [retryCount]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {username}!</p>

      {loading && <p>Loading your activities...</p>}

      {dashboardData?.recentActions && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Recent Activity</h3>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {dashboardData.recentActions.map((action, i) => (
              <li 
                key={i} 
                style={{ 
                  padding: "8px 0", 
                  borderBottom: "1px solid #eee",
                  color: retryCount >= 3 ? "#888" : "inherit"
                }}
              >
                {action}
              </li>
            ))}
          </ul>
          {retryCount >= 3 && (
            <button 
              onClick={fetchData}
              style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
            >
              Retry Loading Data
            </button>
          )}
        </div>
      )}
    </div>
  );
}