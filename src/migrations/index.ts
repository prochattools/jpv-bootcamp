import * as migration_20260620_213328 from './20260620_213328';
import * as migration_20260621_194424_course_system_phase1 from './20260621_194424_course_system_phase1';
import * as migration_20260622_093852_course_private_media from './20260622_093852_course_private_media';

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
  {
    up: migration_20260622_093852_course_private_media.up,
    down: migration_20260622_093852_course_private_media.down,
    name: '20260622_093852_course_private_media',
  },
];
