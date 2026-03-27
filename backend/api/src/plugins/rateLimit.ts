import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

export const registerRateLimit = async (app: FastifyInstance) => {
  await app.register(rateLimit, {
    global: false,
  });
};
