import { completeAccountDeletion } from "./account-deletion.ts";

function assertEquals(actual: unknown, expected: unknown, message = "Values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(action: () => Promise<unknown>, messagePart: string) {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(messagePart)) {
      throw new Error(`Expected rejection containing "${messagePart}"`);
    }
    return;
  }
  throw new Error("Expected the operation to reject");
}

function makeAdmin(options: {
  paths?: unknown;
  storageError?: boolean;
  completionError?: boolean;
  deleteError?: boolean;
  remainingUser?: boolean;
} = {}) {
  const calls: string[] = [];
  const admin = {
    rpc: async (name: string, args: { p_user_id: string }) => {
      calls.push(`rpc:${name}:${args.p_user_id}`);
      if (name === "prepare_account_deletion") {
        return { data: options.paths ?? ["organizer-a/proof.png"], error: null };
      }
      return { data: true, error: options.completionError ? { message: "completion failed" } : null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          calls.push(`storage:${bucket}:${paths.length}`);
          return { error: options.storageError ? { message: "storage unavailable" } : null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          calls.push(`auth:delete:${userId}`);
          return { error: options.deleteError ? { message: "delete failed" } : null };
        },
        getUserById: async (userId: string) => {
          calls.push(`auth:get:${userId}`);
          return {
            data: { user: options.remainingUser === false ? null : { id: userId } },
            error: options.remainingUser === false ? { status: 404, code: "user_not_found" } : null,
          };
        },
      },
    },
  };
  return { admin, calls };
}

Deno.test("account deletion removes Storage before clearing the job and Auth identity", async () => {
  const { admin, calls } = makeAdmin();
  await completeAccountDeletion(admin, "user-a");
  assertEquals(calls, [
    "rpc:prepare_account_deletion:user-a",
    "storage:payment-evidence:1",
    "rpc:complete_account_deletion_storage:user-a",
    "auth:delete:user-a",
  ]);
});

Deno.test("Storage failure preserves the deletion job and does not delete Auth", async () => {
  const { admin, calls } = makeAdmin({ storageError: true });
  await assertRejects(() => completeAccountDeletion(admin, "user-a"), "can be retried");
  assertEquals(calls, [
    "rpc:prepare_account_deletion:user-a",
    "storage:payment-evidence:1",
  ]);
});

Deno.test("malformed Storage manifest fails closed before any deletion", async () => {
  const { admin, calls } = makeAdmin({ paths: ["valid/path.png", null] });
  await assertRejects(() => completeAccountDeletion(admin, "user-a"), "cleanup list");
  assertEquals(calls, ["rpc:prepare_account_deletion:user-a"]);
});

Deno.test("Storage completion failure prevents Auth deletion", async () => {
  const { admin, calls } = makeAdmin({ completionError: true });
  await assertRejects(() => completeAccountDeletion(admin, "user-a"), "could not be confirmed");
  assertEquals(calls, [
    "rpc:prepare_account_deletion:user-a",
    "storage:payment-evidence:1",
    "rpc:complete_account_deletion_storage:user-a",
  ]);
});

Deno.test("Auth deletion failure is retryable while the identity still exists", async () => {
  const { admin, calls } = makeAdmin({ deleteError: true, remainingUser: true });
  await assertRejects(() => completeAccountDeletion(admin, "user-a"), "Auth deletion is pending");
  assertEquals(calls.slice(-2), ["auth:delete:user-a", "auth:get:user-a"]);
});

Deno.test("a concurrent retry treats an already-removed Auth identity as success", async () => {
  const { admin, calls } = makeAdmin({ deleteError: true, remainingUser: false });
  await completeAccountDeletion(admin, "user-a");
  assertEquals(calls.slice(-2), ["auth:delete:user-a", "auth:get:user-a"]);
});

Deno.test("large Storage manifests are removed in batches of at most 100", async () => {
  const paths = Array.from({ length: 205 }, (_, index) => `organizer-a/${index}.png`);
  const { admin, calls } = makeAdmin({ paths });
  await completeAccountDeletion(admin, "user-a");
  assertEquals(calls.filter((call) => call.startsWith("storage:")), [
    "storage:payment-evidence:100",
    "storage:payment-evidence:100",
    "storage:payment-evidence:5",
  ]);
});
