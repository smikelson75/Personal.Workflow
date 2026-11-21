import { chainIdRules } from './chain-ids.mjs';
import { chainLinkRules } from './chain-links.mjs';
import { chainStatusRules } from './chain-status.mjs';
import { excessSizeRules } from './excess-size.mjs';
import { excessStageRules } from './excess-stage.mjs';
import { folderRules } from './folder.mjs';
import { glossaryRules } from './glossary.mjs';
import { sessionBodyRules } from './session-body.mjs';
import { sessionHeaderRules } from './session-header.mjs';
import { vocabularyAvoidRules } from './vocabulary-avoid.mjs';
import { vocabularyConflictRules } from './vocabulary-conflict.mjs';
import { vocabularyMissingRules } from './vocabulary-missing.mjs';
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
  ...vocabularyMissingRules,
  ...excessSizeRules,
  ...excessStageRules,
];
