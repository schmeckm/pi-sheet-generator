import { useRouter } from 'vue-router';

/** Navigate to chat and open PI Sheet preview via query param. */
export function useOpenPiSheet() {
  const router = useRouter();

  function openInChat(piSheetId) {
    if (!piSheetId) return;
    router.push({ name: 'chat', query: { piSheet: piSheetId } });
  }

  return { openInChat };
}
