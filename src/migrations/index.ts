import * as migration_20260620_213328 from './20260620_213328';
import * as migration_20260621_194424_course_system_phase1 from './20260621_194424_course_system_phase1';
import * as migration_20260622_093852_course_private_media from './20260622_093852_course_private_media';
import * as migration_20260627_010700_structured_community_attachments from './20260627_010700_structured_community_attachments';
import * as migration_20260630_100730_affiliate_reporting from './20260630_100730_affiliate_reporting';
import * as migration_20260630_190000_payload_preferences_id_constraint from './20260630_190000_payload_preferences_id_constraint';
import * as migration_20260701_201500_member_email_verification from './20260701_201500_member_email_verification';
import * as migration_20260702_001500_member_account_action_purposes from './20260702_001500_member_account_action_purposes';
import * as migration_20260703_000000_partner_affiliate_operations from './20260703_000000_partner_affiliate_operations';
import * as migration_20260704_090000_partner_schema_reconciliation from './20260704_090000_partner_schema_reconciliation';
import * as migration_20260707_130000_remove_table_plan_from_payload_enums from './20260707_130000_remove_table_plan_from_payload_enums';

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
    name: '20260630_100730_affiliate_reporting',
  },
  {
    up: migration_20260630_190000_payload_preferences_id_constraint.up,
    down: migration_20260630_190000_payload_preferences_id_constraint.down,
    name: '20260630_190000_payload_preferences_id_constraint',
  },
  {
    up: migration_20260701_201500_member_email_verification.up,
    down: migration_20260701_201500_member_email_verification.down,
    name: '20260701_201500_member_email_verification',
  },
  {
    up: migration_20260702_001500_member_account_action_purposes.up,
    down: migration_20260702_001500_member_account_action_purposes.down,
    name: '20260702_001500_member_account_action_purposes',
  },
  {
    up: migration_20260703_000000_partner_affiliate_operations.up,
    down: migration_20260703_000000_partner_affiliate_operations.down,
    name: '20260703_000000_partner_affiliate_operations',
  },
  {
    up: migration_20260704_090000_partner_schema_reconciliation.up,
    down: migration_20260704_090000_partner_schema_reconciliation.down,
    name: '20260704_090000_partner_schema_reconciliation',
  },
  {
    up: migration_20260707_130000_remove_table_plan_from_payload_enums.up,
    down: migration_20260707_130000_remove_table_plan_from_payload_enums.down,
    name: '20260707_130000_remove_table_plan_from_payload_enums',
  },
];
