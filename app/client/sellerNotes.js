"use client";

import { createContext, useContext } from "react";

// Your seller marks, shared by every card on the page. page.js holds the
// synced value and provides it here.
export const SellerNotesContext = createContext({ notes: {}, setMark: () => {} });

export function useSellerNotes() {
  return useContext(SellerNotesContext);
}
