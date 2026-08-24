import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

export function LoginScreen() {
  const { refresh } = useAuth();
  const [googleClientId, setGoogleClientId] = useState<string | null | undefined>(undefined);
  const [allowedEmailDomain, setAllowedEmailDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((c) => {
        setGoogleClientId(c.googleClientId);
        setAllowedEmailDomain(c.allowedEmailDomain);
      })
      .catch(() => setGoogleClientId(null));
  }, []);

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              await api.signInWithGoogle(response.credential);
              await refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
        });
      })
      .catch(() => setError("Could not load Google Sign-In. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [googleClientId, refresh]);

  const [devName, setDevName] = useState("");
  const [devEmail, setDevEmail] = useState("");

  async function handleDevSignIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.devSignIn(devName, devEmail);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Reading Race</h1>
        <p className="subtitle">
          Sign in to manage your class's reading progress.
          {allowedEmailDomain && ` Use your @${allowedEmailDomain} account.`}
        </p>

        {googleClientId === undefined && <p className="empty-hint">Loading…</p>}

        {googleClientId && <div ref={buttonRef} className="google-button-slot" />}

        {googleClientId === null && (
          <div className="dev-login">
            <p className="empty-hint">
              Google sign-in isn't configured on this server yet — see the README to add a
              GOOGLE_CLIENT_ID. Until then, use this test sign-in to try the app.
            </p>
            <form onSubmit={handleDevSignIn}>
              <label className="field">
                <span>Your name</span>
                <input value={devName} onChange={(e) => setDevName(e.target.value)} required />
              </label>
              <label className="field">
                <span>Your email</span>
                <input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="primary">
                Continue (test mode)
              </button>
            </form>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
