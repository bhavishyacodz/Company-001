export async function completeAccountDeletion(admin: any, userId: string): Promise<void> {
  const prepared = await admin.rpc("prepare_account_deletion", { p_user_id: userId });
  if (prepared.error) throw new Error("Could not prepare account deletion.");
  if (!Array.isArray(prepared.data) || prepared.data.some((path: unknown) =>
    typeof path !== "string" || path.length === 0
  )) {
    // Never interpret an unexpected RPC payload as an empty Storage manifest.
    throw new Error("Could not verify the private payment-evidence cleanup list.");
  }

  const paths = [...new Set(prepared.data)];

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from("payment-evidence").remove(paths.slice(index, index + 100));
    if (error) {
      // The SQL job and its paths remain durable; a retry can safely resume.
      throw new Error("Private payment evidence cleanup is pending and can be retried.");
    }
  }

  const completed = await admin.rpc("complete_account_deletion_storage", { p_user_id: userId });
  if (completed.error) {
    throw new Error("Storage cleanup could not be confirmed; account deletion remains pending.");
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // A concurrent retry may already have deleted the identity. Treat that
    // specific outcome as success; preserve real Auth/network failures.
    const { data: remaining, error: lookupError } = await admin.auth.admin.getUserById(userId);
    const definitelyMissing = !remaining?.user && (
      !lookupError || lookupError.status === 404 || lookupError.code === "user_not_found"
    );
    if (!definitelyMissing) {
      throw new Error("Data cleanup completed, but Auth deletion is pending and can be retried.");
    }
  }
}
