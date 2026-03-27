import { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "../env";

export const registerCors = async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
};
