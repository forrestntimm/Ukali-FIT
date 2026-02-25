declare namespace Express {
  interface Request {
    user?: {
      id: string;
      role: "ADMIN" | "MEMBER";
      email?: string;
      authProvider?: "legacy" | "supabase";
    };
  }
}
