process.on("uncaughtException", (err) => {
  console.error("CRITICAL UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL UNHANDLED REJECTION AT:", promise, "REASON:", reason);
});

import express from "express";
import cors from "cors";
import { errorMiddleware } from "./middleware/err.middleware";
import codeBrainRoutes from "./routes/codebrain.route";
import { env } from "./config/env";
const app = express();
app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
);
app.use(express.json());
app.use("/api/v1/codebrain", codeBrainRoutes);
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("Welcom to codebrain");
});
export default app;
