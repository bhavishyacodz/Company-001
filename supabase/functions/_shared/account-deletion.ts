export async function completeAccountDeletion(admin: any, userId: string): Promise<void> {
  const prepared = await admin.rpc("prepare_account_deletion", { p_user_id: userId });
  if (prepared.error) throw new Error("Could not prepare account deletion.");

  const paths = Array.isArray(prepared.data)
    ? [...new Set(prepared.data.filter((path: unknown): path is string =>
        typeof path === "string" && path.length > 0))]
    : [];

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from("payment-evidence").remove(paths.slice(index, index + 100));
    if (error) {
      // The SQL job and its paths remain durable; a retry can safely resume.
      throw new Error("Private payment evidence cleanup is pending and can be retried.");
    }
  }

  const completed = await admin.rpc("complete_account_deletion_storage", { p_user_id: userId });
  if (completed.error || completed.data !== true) {
    throw new Error("Storage cleanup could not be confirmed; account deletion remains pending.");
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // The storage-complete job remains. Retrying replays the same idempotent path cleanup,
    // then retries deleting the Auth identity.
    throw new Error("Data cleanup completed, but Auth deletion is pending and can be retried.");
  }
}
