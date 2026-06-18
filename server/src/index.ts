import express from "express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/err.middleware";
import { fetchRepoFiles } from "./services/github.service";
const app = express();
const files = fetchRepoFiles("https://github.com/kasamthapa/codebrain");
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("HELLO from home");
});
app.listen(env.PORT, () => {
  console.log(`Server is listenign on  ${env.PORT}`);
});
