import * as migration_20260620_213328 from './20260620_213328';
import * as migration_20260621_194424_course_system_phase1 from './20260621_194424_course_system_phase1';
import * as migration_20260622_093852_course_private_media from './20260622_093852_course_private_media';
import * as migration_20260627_010700_structured_community_attachments from './20260627_010700_structured_community_attachments';
import * as migration_20260630_100730_affiliate_reporting from './20260630_100730_affiliate_reporting';

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
  {
    up: migration_20260627_010700_structured_community_attachments.up,
    down: migration_20260627_010700_structured_community_attachments.down,
    name: '20260627_010700_structured_community_attachments',
  },
  {
    up: migration_20260630_100730_affiliate_reporting.up,
    down: migration_20260630_100730_affiliate_reporting.down,
    name: '20260630_100730_affiliate_reporting'
  },
];
