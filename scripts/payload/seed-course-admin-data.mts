import { getPayload } from 'payload'

import config from '../../src/payload.config'
import {
  accessPolicySeeds,
  courseAccessGroupSeeds,
  courseSeeds,
  emailTemplateSeeds,
  spaceSeeds,
} from '../../src/lib/payloadCourse/seedData'

type PayloadClient = Awaited<ReturnType<typeof getPayload>>
type SeedAction = 'create' | 'update' | 'skip'

type SeedStats = {
  create: number
  update: number
  skip: number
}

const apply = process.argv.includes('--apply')

const stats: SeedStats = {
  create: 0,
  update: 0,
  skip: 0,
}

function log(action: SeedAction, label: string) {
  stats[action] += 1
  const prefix = apply ? '[seed]' : '[seed:dry-run]'
  console.log(`${prefix} ${action.toUpperCase()} ${label}`)
}

async function findOne(
  payload: PayloadClient,
  collection: string,
  where: Record<string, unknown>
) {
  const result = await payload.find({
    collection: collection as never,
    where,
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  return result.docs[0] as ({ id: string | number } & Record<string, unknown>) | undefined
}

async function upsertByUnique(
  payload: PayloadClient,
  collection: string,
  uniqueField: string,
  uniqueValue: string,
  data: Record<string, unknown>,
  label: string
) {
  const existing = await findOne(payload, collection, {
    [uniqueField]: { equals: uniqueValue },
  })

  if (!existing) {
    log('create', label)
    if (!apply) return { id: `dry-run:${collection}:${uniqueValue}` }

    return payload.create({
      collection: collection as never,
      data: data as never,
      overrideAccess: true,
    })
  }

  log('update', label)
  if (!apply) return existing

  return payload.update({
    collection: collection as never,
    id: existing.id,
    data: data as never,
    overrideAccess: true,
  })
}

function richTextParagraph(text: string) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text,
              format: 0,
              style: '',
              mode: 'normal',
              version: 1,
            },
          ],
          direction: 'ltr',
          textStyle: '',
          textFormat: 0,
        },
      ],
      direction: 'ltr',
    },
  }
}

async function seedAccessGroups(payload: PayloadClient) {
  for (const seed of courseAccessGroupSeeds) {
    await upsertByUnique(
      payload,
      'payload_access_groups',
      'slug',
      seed.slug,
      {
        name: seed.name,
        slug: seed.slug,
        status: 'active',
        groupType: seed.groupType,
        description: seed.description,
        metadata: {
          seedKey: `course-system:${seed.slug}`,
        },
      },
      `access group ${seed.slug}`
    )
  }
}

async function seedCourses(payload: PayloadClient) {
  for (const course of courseSeeds) {
    const createdCourse = await upsertByUnique(
      payload,
      'payload_courses',
      'slug',
      course.slug,
      {
        prototype: true,
        prototypeKey: course.prototypeKey,
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        description: richTextParagraph(course.shortDescription),
        status: 'published',
        visibility: course.visibility,
        accessBadge: course.accessBadge,
        estimatedDuration: course.estimatedDuration,
        sortOrder: course.sortOrder,
        showInPrototypeDashboard: true,
        featured: Boolean(course.featured),
        mockProgress: 0,
        prototypeNote:
          'Seeded for Payload course-system administration. This is not yet authoritative access data.',
      },
      `course ${course.slug}`
    )

    const courseDoc = createdCourse ?? await findOne(payload, 'payload_courses', {
      slug: { equals: course.slug },
    })

    if (!courseDoc?.id) continue

    for (const moduleSeed of course.modules) {
      const moduleKey = `${course.slug}:${moduleSeed.sortOrder}`
      const moduleDoc = await upsertByUnique(
        payload,
        'payload_course_modules',
        'title',
        moduleSeed.title,
        {
          prototype: true,
          course: courseDoc.id,
          title: moduleSeed.title,
          description: moduleSeed.description,
          sortOrder: moduleSeed.sortOrder,
          publishedPreview: true,
        },
        `module ${moduleKey}`
      )

      const moduleRecord = moduleDoc ?? await findOne(payload, 'payload_course_modules', {
        title: { equals: moduleSeed.title },
      })

      if (!moduleRecord?.id) continue

      for (const lesson of moduleSeed.lessons) {
        await upsertByUnique(
          payload,
          'payload_lessons',
          'slug',
          lesson.slug,
          {
            prototype: true,
            module: moduleRecord.id,
            title: lesson.title,
            slug: lesson.slug,
            summary: lesson.summary,
            sortOrder: lesson.sortOrder,
            estimatedDuration: lesson.estimatedDuration,
            content: richTextParagraph(lesson.summary),
            videoProviderLabel: 'none',
            previewLesson: Boolean(lesson.previewLesson),
            mockCompletionState: 'not_started',
            visualLockState: lesson.previewLesson ? 'available' : 'locked',
            prototypeNote:
              'Seeded for Payload course-system administration. Runtime access is evaluated by service code.',
          },
          `lesson ${lesson.slug}`
        )
      }
    }
  }
}

async function seedEmailTemplates(payload: PayloadClient) {
  for (const seed of emailTemplateSeeds) {
    await upsertByUnique(
      payload,
      'payload_email_templates',
      'templateKey',
      seed.templateKey,
      {
        name: seed.name,
        templateKey: seed.templateKey,
        status: 'active',
        purpose: seed.purpose,
        subject: seed.subject,
        textBody: seed.textBody,
        adminCopyRequired: Boolean(seed.adminCopyRequired),
      },
      `email template ${seed.templateKey}`
    )
  }
}

async function idBySlug(payload: PayloadClient, collection: string, slug: string) {
  return (await findOne(payload, collection, { slug: { equals: slug } }))?.id ?? (
    apply ? null : `dry-run:${collection}:${slug}`
  )
}

async function seedSpaces(payload: PayloadClient) {
  for (const seed of spaceSeeds) {
    const requiredAccessGroups = []
    for (const slug of seed.requiredAccessGroupSlugs ?? []) {
      const id = await idBySlug(payload, 'payload_access_groups', slug)
      if (id) requiredAccessGroups.push(id)
    }

    const linkedCourse = seed.linkedCourseSlug
      ? await idBySlug(payload, 'payload_courses', seed.linkedCourseSlug)
      : null

    await upsertByUnique(
      payload,
      'payload_spaces',
      'slug',
      seed.slug,
      {
        name: seed.name,
        slug: seed.slug,
        status: 'published',
        spaceType: seed.spaceType,
        visibility: seed.visibility,
        requiredAccessGroups,
        linkedCourse,
        description: seed.description,
        sortOrder: seed.sortOrder,
        metadata: {
          seedKey: `course-system:${seed.slug}`,
        },
      },
      `space ${seed.slug}`
    )
  }
}

async function seedAccessPolicies(payload: PayloadClient) {
  for (const seed of accessPolicySeeds) {
    const collection = seed.resourceType === 'course' ? 'payload_courses' : 'payload_spaces'
    const resource = await findOne(payload, collection, {
      slug: { equals: seed.resourceSlug },
    })

    const resourceId = resource?.id ?? (
      apply ? null : `dry-run:${collection}:${seed.resourceSlug}`
    )

    if (!resourceId) {
      log('skip', `access policy ${seed.name} (missing ${seed.resourceType}:${seed.resourceSlug})`)
      continue
    }

    const requiredGroups = []
    for (const slug of seed.requiredAccessGroupSlugs ?? []) {
      const id = await idBySlug(payload, 'payload_access_groups', slug)
      if (id) requiredGroups.push(id)
    }

    const existing = await findOne(payload, 'payload_access_policies', {
      and: [
        { resourceType: { equals: seed.resourceType } },
        { resourceId: { equals: String(resourceId) } },
        { name: { equals: seed.name } },
      ],
    })

    const data = {
      name: seed.name,
      status: 'active',
      resourceType: seed.resourceType,
      resourceId: String(resourceId),
      privacy: seed.privacy,
      allowedPlans: seed.allowedPlans ?? [],
      requiredGroups,
      requireActiveBilling: seed.requireActiveBilling,
      allowPreviewLessons: Boolean(seed.allowPreviewLessons),
      priority: seed.priority,
      notes: 'Seeded for Payload course-system access evaluation.',
      metadata: {
        seedKey: `course-system:${seed.resourceType}:${seed.resourceSlug}`,
      },
    }

    if (!existing) {
      log('create', `access policy ${seed.name}`)
      if (apply) {
        await payload.create({
          collection: 'payload_access_policies' as never,
          data: data as never,
          overrideAccess: true,
        })
      }
      continue
    }

    log('update', `access policy ${seed.name}`)
    if (apply) {
      await payload.update({
        collection: 'payload_access_policies' as never,
        id: existing.id,
        data: data as never,
        overrideAccess: true,
      })
    }
  }
}

async function main() {
  console.log(apply ? '[seed] Applying Payload course admin seed data' : '[seed:dry-run] Previewing Payload course admin seed data')

  const payload = await getPayload({ config })

  await seedAccessGroups(payload)
  await seedCourses(payload)
  await seedEmailTemplates(payload)
  await seedSpaces(payload)
  await seedAccessPolicies(payload)

  console.log(`[seed${apply ? '' : ':dry-run'}] Summary`, stats)
  if (!apply) {
    console.log('[seed:dry-run] No records were written. Re-run with --apply to seed the target database.')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[seed] Failed to seed Payload course admin data', error)
    process.exit(1)
  })
