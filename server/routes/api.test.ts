import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import authRouter from "./auth";
import tripsRouter from "./trips";
import tripContentRouter from "./trip-content";
import { attachUser } from "../auth/middleware";
import { runMigrations } from "../db/migrate-runner";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);
app.use("/api/auth", authRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/trips", tripContentRouter);

beforeAll(async () => {
  await runMigrations();
});

let counter = 0;
async function signupAgent(name = "User") {
  const agent = request.agent(app);
  const email = `test_${Date.now()}_${counter++}@t.dev`;
  const res = await agent
    .post("/api/auth/signup")
    .send({ email, password: "supersecret", displayName: name });
  expect(res.status).toBe(201);
  return { agent, email };
}

describe("Auth", () => {
  it("inscription puis /me renvoie le profil", async () => {
    const { agent } = await signupAgent("Alice");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe("Alice");
  });

  it("refuse /me sans session", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("refuse un mauvais mot de passe", async () => {
    const { email } = await signupAgent("Bob");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "mauvais" });
    expect(res.status).toBe(401);
  });

  it("renvoie un token et authentifie via Bearer (mobile)", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: `tok_${Date.now()}@t.dev`, password: "supersecret", displayName: "Tok" });
    expect(res.body.token).toBeTruthy();
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
  });
});

describe("Voyages — autorisation", () => {
  it("création, isolation, join, ownership", async () => {
    const { agent: alice } = await signupAgent("Alice");
    const { agent: bob } = await signupAgent("Bob");

    const created = await alice
      .post("/api/trips")
      .send({ name: "Rome", selectedDestination: "Rome, Italie" });
    expect(created.status).toBe(201);
    expect(created.body.trip.selectedDestination).toBe("Rome, Italie");
    const id = created.body.trip.id;

    expect((await bob.get(`/api/trips/${id}`)).status).toBe(404); // non-membre
    expect((await bob.post(`/api/trips/${id}/join`)).status).toBe(200);
    expect((await bob.get(`/api/trips/${id}`)).status).toBe(200);
    expect((await bob.delete(`/api/trips/${id}`)).status).toBe(403); // non-owner
    expect((await alice.delete(`/api/trips/${id}`)).status).toBe(204); // owner
  });
});

describe("Contenu collaboratif", () => {
  it("le vote ne change pas la destination ; le choix explicite oui", async () => {
    const { agent: alice } = await signupAgent("Alice");
    const id = (
      await alice.post("/api/trips").send({ name: "T", selectedDestination: "Barcelone" })
    ).body.trip.id;

    let trip = (await alice.post(`/api/trips/${id}/destinations`).send({ name: "Rome" })).body.trip;
    const romeId = trip.destinations.find((d: { name: string }) => d.name === "Rome").id;
    trip = (await alice.post(`/api/trips/${id}/destinations/${romeId}/vote`)).body.trip;
    expect(trip.selectedDestination).toBe("Barcelone"); // non écrasé par le vote

    trip = (await alice.patch(`/api/trips/${id}`).send({ selectedDestination: "Rome" })).body.trip;
    expect(trip.selectedDestination).toBe("Rome"); // choix explicite
  });

  it("ajoute une disponibilité et un message ; bloque les non-membres", async () => {
    const { agent: alice } = await signupAgent("Alice");
    const { agent: eve } = await signupAgent("Eve");
    const id = (await alice.post("/api/trips").send({ name: "T" })).body.trip.id;

    const avail = await alice
      .post(`/api/trips/${id}/availabilities`)
      .send({ start: "2026-07-10", end: "2026-07-15" });
    expect(avail.body.trip.availabilities).toHaveLength(1);

    const msg = await alice.post(`/api/trips/${id}/messages`).send({ text: "Salut" });
    expect(msg.body.trip.messages).toHaveLength(1);

    expect((await eve.post(`/api/trips/${id}/messages`).send({ text: "intrus" })).status).toBe(404);
  });
});
