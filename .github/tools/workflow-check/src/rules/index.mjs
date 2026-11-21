import { folderRules } from './folder.mjs';
import { sessionBodyRules } from './session-body.mjs';
import { sessionHeaderRules } from './session-header.mjs';

export const RULES = [...folderRules, ...sessionHeaderRules, ...sessionBodyRules];
