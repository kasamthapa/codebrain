import express from "express";

import { errorMiddleware } from "./middleware/err.middleware";
import codeBrainRoutes from "./routes/codebrain.route";
const app = express();
app.use(express.json());
app.use("/api/v1/codebrain", codeBrainRoutes);
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("Welcom to codebrain");
});
export default app;
