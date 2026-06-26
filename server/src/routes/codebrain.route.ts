import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  indexController,
  userQueryController,
} from "../controllers/codebrain.controller";
const route = Router();

route.post("/index", asyncHandler(indexController));
route.post("/ask", asyncHandler(userQueryController));

export default route;
