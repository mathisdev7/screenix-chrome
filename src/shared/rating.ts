export const CHROME_WEB_STORE_REVIEWS_URL = "https://chromewebstore.google.com/detail/screenix-for-chrome/daodleelbenbcdllpfecilgeldnncemp/reviews";
export const EXPORTS_BEFORE_RATING = 3;

const STORAGE_KEY = "ratingPrompt";

export interface RatingPromptState {
  exports: number;
  asked: boolean;
}

const INITIAL_STATE: RatingPromptState = { exports: 0, asked: false };

export function ratingPromptDue(state: RatingPromptState): boolean {
  return !state.asked && state.exports >= EXPORTS_BEFORE_RATING;
}

async function readState(): Promise<RatingPromptState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...INITIAL_STATE, ...(stored[STORAGE_KEY] as Partial<RatingPromptState> | undefined) };
}

async function writeState(state: RatingPromptState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function countExport(): Promise<void> {
  const state = await readState();
  await writeState({ ...state, exports: state.exports + 1 });
}

export async function claimRatingPrompt(): Promise<boolean> {
  const state = await readState();
  if (!ratingPromptDue(state)) return false;
  await writeState({ ...state, asked: true });
  return true;
}
