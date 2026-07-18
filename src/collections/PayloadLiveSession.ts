import type { CollectionConfig } from 'payload'

export const PayloadLiveSession: CollectionConfig = {
	slug: 'live_sessions',
	dbName: 'live_sessions',
	labels: {
		singular: 'Live Session',
		plural: 'Live Sessions',
	},
	admin: {
		useAsTitle: 'title',
		defaultColumns: ['title', 'status', 'scheduledAt', 'course', 'createdAt'],
	},
	access: {
		read: ({ req }) => {
			// Authenticated users can read sessions for their enrolled courses
			return !!req.user
		},
		create: ({ req }) => {
			// Only admins can create
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
			label: 'Session Title',
		},
		{
			name: 'status',
			type: 'select',
			options: [
				{ label: 'Scheduled', value: 'scheduled' },
				{ label: 'Live', value: 'live' },
				{ label: 'Completed', value: 'completed' },
				{ label: 'Cancelled', value: 'cancelled' },
			],
			defaultValue: 'scheduled',
			required: true,
		},
		{
			name: 'course',
			type: 'relationship',
			relationTo: 'payload_courses',
			required: true,
			label: 'Course',
		},
		{
			name: 'module',
			type: 'text',
			required: true,
			label: 'Module ID',
		},
		{
			name: 'lesson',
			type: 'text',
			required: true,
			label: 'Lesson ID',
		},
		{
			name: 'roomName',
			type: 'text',
			required: true,
			unique: true,
			index: true,
			label: 'LiveKit Room Name',
			admin: {
				readOnly: true,
				description: 'Auto-generated from course/module/lesson',
			},
		},
		{
			name: 'hostUser',
			type: 'relationship',
			relationTo: 'payload_users',
			required: true,
			label: 'Host (Admin)',
		},
		{
			name: 'scheduledAt',
			type: 'date',
			required: true,
			label: 'Scheduled Start',
		},
		{
			name: 'capacity',
			type: 'number',
			defaultValue: 50,
			label: 'Max Participants',
		},
		{
			name: 'description',
			type: 'richText',
			label: 'Session Description',
		},
		{
			name: 'recordingUrl',
			type: 'text',
			label: 'Recording URL',
			admin: {
				readOnly: true,
				description: 'Set after recording is available',
			},
		},
		{
			name: 'audit',
			type: 'json',
			label: 'Audit Log',
			admin: {
				readOnly: true,
				description: 'Automatic timestamps of key events',
			},
		},
	],
	timestamps: true,
}
