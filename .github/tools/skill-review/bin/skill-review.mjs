#!/usr/bin/env node
import { main } from '../src/cli.mjs';

const { lines, code } = main(process.argv.slice(2), process.env, process.cwd());
process.stdout.write(lines.map((l) => `${l}\n`).join(''));
process.exit(code);
