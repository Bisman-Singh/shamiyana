import { z } from "zod";

// Zod probes for eval with new Function the first time it parses. The CSP blocks eval,
// and the browser reports the caught probe as a violation, so the probe is switched off.
z.config({ jitless: true });

export { z };
