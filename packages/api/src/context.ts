import { auth } from "@se-project/auth";

export async function createContext(request: {
  headers: Headers;
}) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return {
    headers: request.headers,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
