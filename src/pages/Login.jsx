import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { LOGO_URL } from "@/lib/brand";

const HERO_URL = "/images/login-background.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  // When no explicit returnTo is present, route through /login-redirect which
  // sends staff to the admin dashboard and 'user' role to the customer site.
  const rawReturnTo = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = safeReturnTo();
  const postLoginDest = rawReturnTo ? returnTo : "/login-redirect";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      window.location.href = postLoginDest;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    api.auth.loginWithProvider("google", postLoginDest);
  };

  return (
    <div className="relative flex min-h-screen w-full select-none flex-col items-center justify-center overflow-x-hidden bg-stone-100 font-sans">
      <div
        className="fixed inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${HERO_URL})` }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 bg-amber-50/20 backdrop-blur-[0.5px]"
          style={{
            background:
              "radial-gradient(circle, rgba(30, 20, 15, 0.45) 0%, rgba(20, 10, 5, 0.75) 100%)",
          }}
        />
      </div>

      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 sm:py-12">
        <header className="mb-6 flex w-full max-w-md flex-col items-center">
          <div className="relative flex flex-col items-center justify-center">
            <div
              className="pointer-events-none absolute -bottom-8 -left-12 -right-12 -top-8 -z-10 h-48 rounded-full opacity-80 blur-[6px]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(254, 237, 214, 0.95) 0%, rgba(254, 237, 214, 0.7) 45%, rgba(254, 237, 214, 0) 75%)",
              }}
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-44 w-44 items-center justify-center overflow-hidden rounded-full border border-stone-200/80 bg-white p-3 shadow-xl sm:h-48 sm:w-48">
              <img
                src={LOGO_URL}
                alt="Nanay Asa Restaurant"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </header>

        <section className="w-full max-w-[430px] rounded-xl border border-stone-200/80 bg-white p-6 shadow-xl sm:p-8">
          <Button
            type="button"
            variant="outline"
            className="flex h-auto w-full items-center justify-center gap-3 rounded-md border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition-colors duration-150 hover:bg-stone-50 focus-visible:ring-stone-400"
            onClick={handleGoogle}
          >
            <GoogleIcon className="h-4 w-4" />
            <span>Continue with Google</span>
          </Button>

          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full border-t border-stone-200" />
            <span className="absolute bg-white px-3 text-xs font-medium uppercase tracking-wider text-stone-400">
              OR
            </span>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="block text-sm font-bold text-stone-900">
                Email
              </Label>
              <div className="relative rounded-md shadow-sm">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block h-auto w-full rounded-md border-stone-300 py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition focus-visible:ring-stone-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="block text-sm font-bold text-stone-900">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-stone-500 transition-colors hover:text-stone-800"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative rounded-md shadow-sm">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block h-auto w-full rounded-md border-stone-300 py-2.5 pl-10 pr-3 text-sm tracking-widest text-stone-900 placeholder:text-stone-400 transition focus-visible:ring-stone-500"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="flex h-auto w-full justify-center rounded-md bg-[#171717] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-black active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Log in"
                )}
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
