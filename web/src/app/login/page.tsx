import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-28 sm:items-center">
      <LoginForm />
    </main>
  );
}
