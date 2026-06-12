import dotenv from "dotenv";
dotenv.config();

const required = [
  "PORT",
  "OPENAI_API_KEY",
  "DATABASE_URL",
  "GITHUB_TOKEN",
  "CORS_ORIGIN",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}
export const env = {
  PORT: process.env["PORT"] as string,
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"] as string,
  DATABASE_URL: process.env["DATABASE_URL"] as string,
  GITHUB_TOKEN: process.env["GITHUB_TOKEN"] as string,
  CORS_ORIGIN: process.env["CORS_ORIGIN"] as string,
};
