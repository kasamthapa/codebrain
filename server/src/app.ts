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
