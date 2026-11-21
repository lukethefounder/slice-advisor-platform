"use client";

import {
  useState,
  type FormEvent,
} from "react";

import FounderAccessFrame from "@/components/access-experience/founder-access-frame";


type LoginResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  isFounder?: boolean;
  betaAccess?: boolean;
  error?: string | { message?: string };
  mfaRequired?: boolean;
};

export default function FounderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    "Your research and firm workspace are waiting.",
  );
  const [loading, setLoading] = useState(false);
  const [factorRequired, setFactorRequired] = useState(false);
  const [factorCode, setFactorCode] = useState("");

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
          factorCode: factorRequired ? factorCode : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;
      const errorMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;

      if (payload.mfaRequired) {
        setFactorRequired(true); setFactorCode("");
        setMessage(errorMessage || "Enter your authenticator code or a saved recovery code.");
        return;
      }

      if (!response.ok || !payload.user) {
        throw new Error(errorMessage || "Sign in failed.");
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

  return <FounderAccessFrame email={email} secret={password} onEmailChange={value => {setEmail(value);setFactorRequired(false);setFactorCode("");}} onSecretChange={value => {setPassword(value);setFactorRequired(false);setFactorCode("");}} onSubmit={login} loading={loading} message={message} factorRequired={factorRequired} factorCode={factorCode} onFactorChange={setFactorCode}/>;
}
