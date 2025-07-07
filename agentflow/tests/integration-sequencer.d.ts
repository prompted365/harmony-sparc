import TestSequencer from '@jest/test-sequencer';
import type { Test } from '@jest/test-result';

declare class IntegrationTestSequencer extends TestSequencer {
  sort(tests: Array<Test>): Array<Test> | Promise<Array<Test>>;
}

export = IntegrationTestSequencer;
