import type { ReactNode } from "react";

/** Link destinations are fixed; legal text continues to come from next-intl. */
export const legalTextLinks = {
  contact: (chunks: ReactNode) => <a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>,
  coContact: (chunks: ReactNode) => <a href="mailto:m.schmidt.d@hotmail.com" className="text-gold hover:underline">{chunks}</a>,
  phone: (chunks: ReactNode) => <a href="tel:+491713866624" className="text-gold hover:underline">{chunks}</a>,
  authority: (chunks: ReactNode) => <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>,
};
