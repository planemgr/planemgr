import { useState } from "react";

type LoginScreenProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  error?: string | null;
};

export const LoginScreen = ({ onLogin, error }: LoginScreenProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">Plane Manager</div>
        <p className="login__subtitle">
          Infrastructure as visualization. Build, layer, and verify execution plans.
        </p>
        <form className="login__form" onSubmit={handleSubmit}>
          <label className="login__field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </label>
          <label className="login__field">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="login__error">{error}</div> : null}
          <button type="submit" disabled={submitting || !username || !password}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
      <div className="login__backdrop" />
    </div>
  );
};
