console.log("ENV CHECK:", {
  PORT: process.env.PORT,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "set" : "missing",
  DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "set" : "missing",
  CORS_ORIGIN: process.env.CORS_ORIGIN ? "set" : "missing",
});
import { env } from "./config/env";
import app from "./app";

app.listen(env.PORT, () => {
  console.log(`Server is listening on PORT: ${env.PORT}`);
});
