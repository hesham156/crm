"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Eye, EyeOff, Printer, Zap } from "lucide-react";
import type { Metadata } from "next";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data.email, data.password);
      const { access, refresh, user } = response.data;
      setAuth(user, access, refresh);
      toast.success(`Welcome back, ${user.full_name_en}! 👋`);
      router.push("/");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-6)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 30% 50%, rgba(249,115,22,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div style={{
            width: "72px",
            height: "72px",
            background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            borderRadius: "var(--radius-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto var(--space-4)",
            boxShadow: "var(--shadow-glow)",
            fontSize: "32px",
          }}>
            🖨️
          </div>
          <h1 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "2rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "var(--space-1)",
          }}>
            ProSticker ERP
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="card card-elevated" style={{
          padding: "var(--space-8)",
          borderRadius: "var(--radius-xl)",
        }}>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                {...register("email")}
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@company.com"
                autoComplete="email"
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  {...register("password")}
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{ paddingRight: "var(--space-10)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "var(--space-3)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading}
              style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-2)" }}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
                  Signing in...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

       
        </div>

        <p style={{
          textAlign: "center",
          marginTop: "var(--space-6)",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}>
          ProSticker ERP v1.0 — Printing & Marketing Workflow
        </p>
      </div>
    </div>
  );
}
