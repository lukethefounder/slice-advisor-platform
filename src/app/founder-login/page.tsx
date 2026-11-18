"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  useState,
  type FormEvent,
} from "react";

import {
  BrandMark,
  Card,
  Pill,
  SliceBackground,
  SoftCard,
  cx,
} from "@/components/slice-ui";
// SLICE_ACCESS_SURFACE_V1 — existing authentication and client context retained.
import { AccessFrame } from "@/components/access-experience/access-frame";


type LoginResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  isFounder?: boolean;
  betaAccess?: boolean;
  error?: string;
};

export default function FounderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    "Use a real firm owner or invited advisor account.",
  );
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Sign in failed.");
      }

      setMessage("Access verified. Opening the advisor workspace.");
      window.location.href = "/workspace";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return <AccessFrame variant="founder" email={email} secret={password} onEmailChange={setEmail} onSecretChange={setPassword} onSubmit={login} loading={loading} message={message}/>;
}