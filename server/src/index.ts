import express from "express";
import { env } from "./config/env.ts";
const app = express();
app.get("/", (req, res) => {
  res.send("HELLO from home");
});
app.listen(5000, () => {
  console.log(`Server is listenign on port 50000`);
});
