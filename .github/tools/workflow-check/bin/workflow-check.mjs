#!/usr/bin/env node
import { run } from '../src/run.mjs';

const result = run({ cwd: process.cwd(), args: process.argv.slice(2) });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
