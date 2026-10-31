import { assertEquals } from "jsr:@std/assert@1";
import { readBodyLimited } from "./request-body.ts";

Deno.test("readBodyLimited accepts a body at the configured limit", async () => {
  const request = new Request("https://example.test/register", {
    method: "POST",
    body: "12345",
  });
  const body = await readBodyLimited(request, 5);
  assertEquals(new TextDecoder().decode(body ?? new Uint8Array()), "12345");
});

Deno.test("readBodyLimited rejects a body larger than the configured limit", async () => {
  const request = new Request("https://example.test/register", {
    method: "POST",
    body: "123456",
  });
  assertEquals(await readBodyLimited(request, 5), null);
});

Deno.test("readBodyLimited returns an empty body when no body is supplied", async () => {
  const request = new Request("https://example.test/register", { method: "POST" });
  assertEquals((await readBodyLimited(request, 5))?.byteLength, 0);
});
