import { RequestHandler } from "express";

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
