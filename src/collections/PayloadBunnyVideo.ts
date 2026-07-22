import type { CollectionConfig } from 'payload'

export const PayloadBunnyVideo: CollectionConfig = {
	slug: 'bunny_videos',
	dbName: 'bunny_videos',
	labels: {
		singular: 'Bunny Video',
		plural: 'Bunny Videos',
	},
	admin: {
		useAsTitle: 'title',
		defaultColumns: ['title', 'status', 'duration', 'libraryId', 'videoId', 'createdAt'],
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
			required: true,
			label: 'Bunny Video ID (numeric)',
		},
		{
			name: 'videoGuid',
			type: 'text',
			label: 'Bunny Video GUID (UUID)',
			admin: {
				description:
					'UUID string from Bunny Stream API (VideoGuid field). Used in CDN delivery URLs. ' +
					'Required for signed playback. Populated automatically from Bunny webhooks.',
				readOnly: true,
			},
		},
		{
			name: 'lessonId',
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
