import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/authentication/login/login.jsx";
import Dashboard from "./components/dashboard/dashboard.jsx"; // create this component
import Homepage from "./components/dashboard/homePage.jsx"; // create this component'
import LogsPage from "./components/logs/logs.jsx"; // create this component

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Homepage />} />
        <Route path="/logs" element= {<LogsPage/>}/>
      </Routes>
    </Router>
  );
}
