"use client";
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';

export default function AppIntlProvider({locale,messages,children}:{locale:string;messages:AbstractIntlMessages;children:ReactNode}) {
  return <NextIntlClientProvider locale={locale} messages={messages}
    onError={error=>console.warn('Translation error',error.code)}
    getMessageFallback={()=>String((messages.common as Record<string,unknown>)?.translationUnavailable ?? '')}>
    {children}
  </NextIntlClientProvider>;
}
