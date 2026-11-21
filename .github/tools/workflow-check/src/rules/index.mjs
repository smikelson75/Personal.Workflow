import { chainIdRules } from './chain-ids.mjs';
import { chainLinkRules } from './chain-links.mjs';
import { chainStatusRules } from './chain-status.mjs';
import { folderRules } from './folder.mjs';
import { glossaryRules } from './glossary.mjs';
import { sessionBodyRules } from './session-body.mjs';
import { sessionHeaderRules } from './session-header.mjs';
import { vocabularyAvoidRules } from './vocabulary-avoid.mjs';
import { vocabularyConflictRules } from './vocabulary-conflict.mjs';
import { vocabularyRetiredRules } from './vocabulary-retired.mjs';

export const RULES = [
  ...folderRules,
  ...sessionHeaderRules,
  ...sessionBodyRules,
  ...glossaryRules,
  ...chainStatusRules,
  ...chainLinkRules,
  ...chainIdRules,
  ...vocabularyConflictRules,
  ...vocabularyAvoidRules,
  ...vocabularyRetiredRules,
];
