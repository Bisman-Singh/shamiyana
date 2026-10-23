"use client";

import "./globals.css";

/**
 * The last-resort error page, shown when the root layout itself fails. It
 * replaces the whole document and can't reach the language provider, so it
 * carries the same short message in both languages instead of loading the
 * dictionaries.
 */
export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="en">
      <body>
        <main id="main" className="wrap page-message">
          <h1>Something went wrong</h1>
          <p>This page hit an error. Your saved plans are untouched.</p>
          <p lang="hi">इस पेज में गड़बड़ी हुई। आपकी सहेजी गई योजनाएँ सुरक्षित हैं।</p>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again <span lang="hi">/ फिर से कोशिश करें</span>
          </button>
        </main>
      </body>
    </html>
  );
}
