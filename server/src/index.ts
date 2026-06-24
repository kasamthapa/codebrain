import express from "express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/err.middleware";
const app = express();
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("HELLO from home");
});
app.listen(env.PORT, () => {
  console.log(`Server is listenign on  ${env.PORT}`);
});
import db from "./lib/db";

db.query("SELECT 1")
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });
