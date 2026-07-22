import type { CollectionConfig } from 'payload'

function generateLiveKitRoomName(courseId: string, moduleId: string, lessonId: string): string {
	return `course-${courseId}-module-${moduleId}-lesson-${lessonId}`.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

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
		read: async ({ req }) => {
			// Admins: can read all
			if (req.user?.collection === 'payload_users') {
				return true
			}
			// Members: can read sessions only for courses they have an active enrollment in.
			// We query enrollments here and build a Where clause so Payload scopes the result set.
			if (req.user?.collection === 'payload_members') {
				// Circular-require guard: import getPayload lazily to avoid startup issues
				const { getPayload: getPayloadLib } = await import('payload')
				const { default: payloadConfig } = await import('@payload-config')
				const payloadInst = await getPayloadLib({ config: payloadConfig })

				const enrollments = await payloadInst.find({
					collection: 'payload_course_enrollments',
					where: {
						and: [
							{ member: { equals: req.user.id } },
							{ status: { equals: 'active' } },
						],
					},
					limit: 200,
					depth: 0,
					overrideAccess: true,
				})

				const courseIds = enrollments.docs
					.map((e: any) => {
						const c = e.course
						return typeof c === 'object' && c !== null ? c.id : c
					})
					.filter(Boolean)

				if (courseIds.length === 0) {
					// Member has no active enrollments — deny all session reads
					return false
				}

				// Return a Where clause that restricts to only sessions for enrolled courses
				return { course: { in: courseIds } }
			}
			return false
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
	hooks: {
		beforeValidate: [
			async ({ data }) => {
				// Generate deterministic roomName if not already set
				if (!data.roomName && data.course) {
					const courseId = typeof data.course === 'object' ? data.course?.id : data.course
					const moduleId = data.module || 'default'
					const lessonId = data.lesson || 'default'
					data.roomName = generateLiveKitRoomName(String(courseId), String(moduleId), String(lessonId))
				}
				return data
			},
		],
		beforeChange: [
			async ({ data, originalDoc }) => {
				// Prevent roomName changes after creation
				if (originalDoc?.id && data.roomName && data.roomName !== originalDoc.roomName) {
					throw new Error('Room name cannot be changed after creation')
				}
				return data
			},
		],
		afterChange: [
			async ({ doc, operation }) => {
				// Log status transitions
				if (operation === 'update' && doc.audit) {
					const now = new Date().toISOString()
					if (!Array.isArray(doc.audit)) {
						doc.audit = []
					}
					(doc.audit as any[]).push({
						event: 'status_updated',
						status: doc.status,
						timestamp: now,
					})
				}
				return doc
			},
		],
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
