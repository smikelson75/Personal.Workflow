// Turns /pull-work arguments into a slug and a bug description.
// Prints JSON {"slug","bug"} to stdout. Problems go to stderr, one per line.
// Exit 0 (ok), 2 (usage error).
// Usage: node parse-args.mjs [<argument text>...]   (run from the repository root)

const USAGE = '/pull-work [<slug>] bug: <description>';

const text = process.argv.slice(2).join(' ').trim();
const BUG = /^(?:(\S+?)\s+)?bug:([\s\S]*)$/;
const match = BUG.exec(text);

if (match) {
  const slug = match[1] ?? null;
  const bug = match[2].trim();
  if (bug === '') {
    console.error(USAGE);
    process.exit(2);
  }
  process.stdout.write(`${JSON.stringify({ slug, bug })}\n`);
  process.exit(0);
}

if (text !== '' && !/^[a-z0-9][a-z0-9-]*$/.test(text)) {
  console.error(USAGE);
  process.exit(2);
}

const slug = text === '' ? null : text;
process.stdout.write(`${JSON.stringify({ slug, bug: null })}\n`);
process.exit(0);
