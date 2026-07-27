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
import * as migration_20260718_103726_membership_support_schema from './20260718_103726_membership_support_schema';
import * as migration_20260718_000000_live_sessions from './20260718_000000_live_sessions';
import * as migration_20260718_110000_bunny_videos from './20260718_110000_bunny_videos';
import * as migration_20260719_150000_subscription_schema_cols from './20260719_150000_subscription_schema_cols';
import * as migration_20260720_000000_locked_docs_rels_new_collections from './20260720_000000_locked_docs_rels_new_collections';
import * as migration_20260722_100000_reconcile_lockstate_vip_progress from './20260722_100000_reconcile_lockstate_vip_progress';
import * as migration_20260723_000000_singular_membership_plan from './20260723_000000_singular_membership_plan';
import * as migration_20260723_000001_migrate_pro_to_membership from './20260723_000001_migrate_pro_to_membership';
import * as migration_20260724_120000_operator_content_media from './20260724_120000_operator_content_media';
import * as migration_20260724_121000_billing_operator_actions from './20260724_121000_billing_operator_actions';
import * as migration_20260724_122000_live_session_relationships from './20260724_122000_live_session_relationships';
import * as migration_20260724_123000_email_operator_actions from './20260724_123000_email_operator_actions';
import * as migration_20260727_000000_partner_applications_source_member_id from './20260727_000000_partner_applications_source_member_id';
import * as migration_20260727_100000_email_events_lease_columns from './20260727_100000_email_events_lease_columns';
import * as migration_20260727_200000_email_events_processing_status from './20260727_200000_email_events_processing_status';

export const migrations = [
  { up: migration_20260620_213328.up, down: migration_20260620_213328.down, name: '20260620_213328' },
  { up: migration_20260621_194424_course_system_phase1.up, down: migration_20260621_194424_course_system_phase1.down, name: '20260621_194424_course_system_phase1' },
  { up: migration_20260622_093852_course_private_media.up, down: migration_20260622_093852_course_private_media.down, name: '20260622_093852_course_private_media' },
  { up: migration_20260627_010700_structured_community_attachments.up, down: migration_20260627_010700_structured_community_attachments.down, name: '20260627_010700_structured_community_attachments' },
  { up: migration_20260630_100730_affiliate_reporting.up, down: migration_20260630_100730_affiliate_reporting.down, name: '20260630_100730_affiliate_reporting' },
  { up: migration_20260630_190000_payload_preferences_id_constraint.up, down: migration_20260630_190000_payload_preferences_id_constraint.down, name: '20260630_190000_payload_preferences_id_constraint' },
  { up: migration_20260701_201500_member_email_verification.up, down: migration_20260701_201500_member_email_verification.down, name: '20260701_201500_member_email_verification' },
  { up: migration_20260702_001500_member_account_action_purposes.up, down: migration_20260702_001500_member_account_action_purposes.down, name: '20260702_001500_member_account_action_purposes' },
  { up: migration_20260703_000000_partner_affiliate_operations.up, down: migration_20260703_000000_partner_affiliate_operations.down, name: '20260703_000000_partner_affiliate_operations' },
  { up: migration_20260704_090000_partner_schema_reconciliation.up, down: migration_20260704_090000_partner_schema_reconciliation.down, name: '20260704_090000_partner_schema_reconciliation' },
  { up: migration_20260707_130000_remove_table_plan_from_payload_enums.up, down: migration_20260707_130000_remove_table_plan_from_payload_enums.down, name: '20260707_130000_remove_table_plan_from_payload_enums' },
  { up: migration_20260718_103726_membership_support_schema.up, down: migration_20260718_103726_membership_support_schema.down, name: '20260718_103726_membership_support_schema' },
  { up: migration_20260718_000000_live_sessions.up, down: migration_20260718_000000_live_sessions.down, name: '20260718_000000_live_sessions' },
  { up: migration_20260718_110000_bunny_videos.up, down: migration_20260718_110000_bunny_videos.down, name: '20260718_110000_bunny_videos' },
  { up: migration_20260719_150000_subscription_schema_cols.up, down: migration_20260719_150000_subscription_schema_cols.down, name: '20260719_150000_subscription_schema_cols' },
  { up: migration_20260720_000000_locked_docs_rels_new_collections.up, down: migration_20260720_000000_locked_docs_rels_new_collections.down, name: '20260720_000000_locked_docs_rels_new_collections' },
  { up: migration_20260722_100000_reconcile_lockstate_vip_progress.up, down: migration_20260722_100000_reconcile_lockstate_vip_progress.down, name: '20260722_100000_reconcile_lockstate_vip_progress' },
  { up: migration_20260723_000000_singular_membership_plan.up, down: migration_20260723_000000_singular_membership_plan.down, name: '20260723_000000_singular_membership_plan' },
  { up: migration_20260723_000001_migrate_pro_to_membership.up, down: migration_20260723_000001_migrate_pro_to_membership.down, name: '20260723_000001_migrate_pro_to_membership' },
  { up: migration_20260724_120000_operator_content_media.up, down: migration_20260724_120000_operator_content_media.down, name: '20260724_120000_operator_content_media' },
  { up: migration_20260724_121000_billing_operator_actions.up, down: migration_20260724_121000_billing_operator_actions.down, name: '20260724_121000_billing_operator_actions' },
  { up: migration_20260724_122000_live_session_relationships.up, down: migration_20260724_122000_live_session_relationships.down, name: '20260724_122000_live_session_relationships' },
  { up: migration_20260724_123000_email_operator_actions.up, down: migration_20260724_123000_email_operator_actions.down, name: '20260724_123000_email_operator_actions' },
  { up: migration_20260727_000000_partner_applications_source_member_id.up, down: migration_20260727_000000_partner_applications_source_member_id.down, name: '20260727_000000_partner_applications_source_member_id' },
  { up: migration_20260727_100000_email_events_lease_columns.up, down: migration_20260727_100000_email_events_lease_columns.down, name: '20260727_100000_email_events_lease_columns' },
  { up: migration_20260727_200000_email_events_processing_status.up, down: migration_20260727_200000_email_events_processing_status.down, name: '20260727_200000_email_events_processing_status' },
];
