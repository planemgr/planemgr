import { useEffect, useState } from "react";
import { api } from "./api";
import { LoginScreen } from "./components/LoginScreen";
import { WorkspaceView } from "./components/WorkspaceView";

const App = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSession()
      .then((session) => {
        if (session.authenticated && session.user) {
          setAuthenticated(true);
          setUsername(session.user.username);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (inputUsername: string, password: string) => {
    setError(null);
    try {
      const response = await api.login(inputUsername, password);
      setAuthenticated(true);
      setUsername(response.user.username);
    } catch (error) {
      console.error(error);
      setError("Invalid credentials. Please try again.");
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    setUsername("");
  };

  if (loading) {
    return <div className="loading">Checking session...</div>;
  }

  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} error={error} />;
  }

  return <WorkspaceView username={username} onLogout={handleLogout} />;
};

export default App;
