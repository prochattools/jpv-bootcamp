import type { CollectionConfig } from 'payload'

export const PayloadBunnyVideo: CollectionConfig = {
	slug: 'bunny_videos',
	dbName: 'bunny_videos',
	labels: {
		singular: 'Bunny Video',
		plural: 'Bunny Videos',
	},
	admin: {
		group: 'Content',
		useAsTitle: 'title',
		defaultColumns: ['title', 'status', 'duration', 'lesson', 'libraryId', 'createdAt'],
		description: 'Bunny Stream video records. Created automatically by the Bunny webhook — do not create manually.',
	},
	access: {
		read: ({ req }) => {
			// Admins can read all; members cannot directly query
			return req.user?.collection === 'payload_users'
		},
		create: ({ req }) => {
			// Only system/webhooks can create
			return req.user?.collection === 'payload_users'
		},
		update: ({ req }) => {
			// Only admins can update
			return req.user?.collection === 'payload_users'
		},
		delete: ({ req }) => {
			// Only admins can delete
			return req.user?.collection === 'payload_users'
		},
	},
	fields: [
		{
			name: 'title',
			type: 'text',
			required: true,
			label: 'Video Title',
		},
		{
			name: 'libraryId',
			type: 'number',
			required: true,
			label: 'Bunny Library ID',
			unique: false,
		},
		{
			name: 'videoId',
			type: 'number',
			label: 'Legacy Bunny Video ID (numeric)',
			admin: {
				description: 'Legacy compatibility only. New Bunny Stream records are identified by videoGuid.',
				readOnly: true,
			},
		},
		{
			name: 'videoGuid',
			type: 'text',
			label: 'Bunny Video GUID (canonical)',
			unique: true,
			admin: {
				description:
					'Canonical Bunny Stream video identifier. Required for new writes and signed playback. ' +
					'Legacy numeric-only rows may remain temporarily until the GUID-first forward migration/backfill is complete.',
				readOnly: true,
			},
		},
		{
			name: 'lesson',
			type: 'relationship',
			relationTo: 'payload_lessons',
			label: 'Associated Lesson',
			admin: {
				description: 'Lesson this video belongs to. One video per lesson.',
			},
		},
		{
			name: 'status',
			type: 'select',
			options: [
				{ label: 'Processing', value: 'processing' },
				{ label: 'Ready', value: 'ready' },
				{ label: 'Failed', value: 'failed' },
			],
			defaultValue: 'processing',
			required: true,
			label: 'Processing Status',
		},
		{
			name: 'duration',
			type: 'number',
			label: 'Duration (seconds)',
		},
		{
			name: 'frameRate',
			type: 'number',
			label: 'Frame Rate (fps)',
		},
		{
			name: 'width',
			type: 'number',
			label: 'Video Width (px)',
		},
		{
			name: 'height',
			type: 'number',
			label: 'Video Height (px)',
		},
		{
			name: 'videoCodec',
			type: 'text',
			label: 'Video Codec',
		},
		{
			name: 'audioCodec',
			type: 'text',
			label: 'Audio Codec',
		},
		{
			name: 'bitrate',
			type: 'number',
			label: 'Bitrate (kbps)',
		},
		{
			name: 'thumbnailUrl',
			type: 'text',
			label: 'Thumbnail URL',
		},
		{
			name: 'playbackUrl',
			type: 'text',
			label: 'Playback URL',
			admin: {
				readOnly: true,
				description: 'Signed URL for playback (regenerated on demand)',
			},
		},
		{
			name: 'errorMessage',
			type: 'text',
			label: 'Error Message',
			admin: {
				readOnly: true,
			},
		},
		{
			name: 'webhookEvents',
			type: 'json',
			label: 'Webhook Event Log',
			admin: {
				readOnly: true,
				description: 'Chronological log of Bunny webhook events',
			},
		},
	],
	timestamps: true,
}
