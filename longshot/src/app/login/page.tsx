"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto text-center space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LongShot</h1>
          <p className="text-muted-foreground mt-2">
            AI 쇼츠 자동 생성 서비스
          </p>
        </div>

        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Google 계정으로 시작하기
          </Button>
          <p className="text-xs text-muted-foreground">
            가입 즉시 <strong>30분 무료 이용권</strong>이 지급됩니다.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          로그인 시{" "}
          <a href="/terms" className="underline">이용약관</a> 및{" "}
          <a href="/privacy" className="underline">개인정보처리방침</a>에
          동의하는 것으로 간주합니다.
        </p>
      </div>
    </div>
  );
}
