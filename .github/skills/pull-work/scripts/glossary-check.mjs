// Checks that the Glossary exists at .workflow/language.md under the current directory.
// Exit 0 silently when present. Exit 2 when missing, with the redirect message on stderr.
// Writes no files.
// Usage: node glossary-check.mjs   (run from the repository root)

import { existsSync } from 'node:fs';

const GLOSSARY = '.workflow/language.md';

if (existsSync(GLOSSARY)) {
  process.exit(0);
}

console.error(
  `Missing required Glossary at ${GLOSSARY}. Run /brain-storm to establish it before continuing with /pull-work.`,
);
process.exit(2);
