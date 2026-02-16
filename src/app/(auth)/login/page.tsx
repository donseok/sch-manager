"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        loginId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
            <CalendarDays className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            근무표 관리시스템 로그인
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            계정 정보를 입력해주세요
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            {/* Login ID */}
            <div>
              <label
                htmlFor="loginId"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                아이디
              </label>
              <input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              로그인
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
