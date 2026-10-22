import { config } from "zod/v4/core";

// Zod probes for eval with new Function the first time it parses. The CSP blocks eval,
// and the browser reports even a caught probe as a violation, so the probe is switched off.
config({ jitless: true });
