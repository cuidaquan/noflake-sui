import Fastify from "fastify";
import type { NoFlakeDatabase } from "./types";

export interface ServerOptions {
  db: NoFlakeDatabase;
}

export function createServer({ db }: ServerOptions) {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
  });

  app.options("/*", async (_request, reply) => reply.code(204).send());

  app.get("/health", async () => ({ ok: true }));

  app.get("/events/:eventId", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const event = db.getEvent(eventId);
    if (!event) {
      return reply.code(404).send({ error: "event_not_found" });
    }

    return {
      ...event,
      reservations: db.getReservationsForEvent(eventId),
      settlement: db.getSettlementForEvent(eventId) ?? null,
    };
  });

  app.get("/reservations/:reservationId", async (request, reply) => {
    const { reservationId } = request.params as { reservationId: string };
    const reservation = db.getReservation(reservationId);
    if (!reservation) {
      return reply.code(404).send({ error: "reservation_not_found" });
    }

    return reservation;
  });

  app.get("/events/:eventId/settlement", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const settlement = db.getSettlementForEvent(eventId);
    if (!settlement) {
      return reply.code(404).send({ error: "settlement_not_found" });
    }

    return settlement;
  });

  return app;
}
