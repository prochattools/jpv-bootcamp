import * as migration_20260620_213328 from './20260620_213328';
import * as migration_20260621_194424_course_system_phase1 from './20260621_194424_course_system_phase1';

export const migrations = [
  {
    up: migration_20260620_213328.up,
    down: migration_20260620_213328.down,
    name: '20260620_213328',
  },
  {
    up: migration_20260621_194424_course_system_phase1.up,
    down: migration_20260621_194424_course_system_phase1.down,
    name: '20260621_194424_course_system_phase1',
  },
];
