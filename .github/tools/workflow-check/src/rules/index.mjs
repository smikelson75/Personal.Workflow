import { chainStatusRules } from './chain-status.mjs';
import { folderRules } from './folder.mjs';
import { glossaryRules } from './glossary.mjs';
import { sessionBodyRules } from './session-body.mjs';
import { sessionHeaderRules } from './session-header.mjs';

export const RULES = [...folderRules, ...sessionHeaderRules, ...sessionBodyRules, ...glossaryRules, ...chainStatusRules];
