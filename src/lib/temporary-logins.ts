export const temporaryLoginAccounts: Array<{
  label: string;
  email: string;
  password: string;
  name: string;
  role: string;
  description: string;
}> = [];

export async function ensureTemporaryLogins() {
  return {
    enabled: false,
    accounts: temporaryLoginAccounts,
    firm: null,
    seedError:
      "Temporary login provisioning is disabled for Slice beta testing.",
  };
}