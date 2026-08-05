// HOTMUM's step engine — the same engine Gabe's rehab runs on, bound to Sam's
// exercises instead of his.
//
// This is the whole reason stepEngine.js was extracted (2026-08-05). Before it,
// the engine looked exercise names up in REHAB_EXERCISES / PROGRAM_EXERCISES,
// so a HOTMUM session played fine but rendered raw ids — "hip-thrust" instead
// of "Hip Thrust" — everywhere a name was shown.
//
// Anything the player needs comes from here, not from rehab.js.

import { createStepEngine } from '../workout/stepEngine.js';
import { HOTMUM_EXERCISES } from './program.js';

export const engine = createStepEngine(HOTMUM_EXERCISES);

export const {
  buildStepQueue,
  sessionOverview,
  nextWorkLabel,
  tempoStateAt,
  sessionSetTotal,
  estimateSessionSecs,
  estimateSessionMins,
  tempoSecsPerRep,
} = engine;
