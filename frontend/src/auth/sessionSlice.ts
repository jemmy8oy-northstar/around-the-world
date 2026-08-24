import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  clearSession,
  readSession,
  writeSession,
  type StoredSession,
} from "./tokenStorage";

interface SessionState {
  session: StoredSession | null;
}

// Seeded from storage so a reload never flashes the join screen before
// rehydrating.
const initialState: SessionState = { session: readSession() };

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<StoredSession>) {
      state.session = action.payload;
      writeSession(action.payload);
    },
    sessionEnded(state) {
      state.session = null;
      clearSession();
    },
  },
});

export const { sessionEstablished, sessionEnded } = sessionSlice.actions;
export default sessionSlice.reducer;
