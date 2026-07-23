export type CourseSeed = {
  slug: string
  prototypeKey: string
  title: string
  shortDescription: string
  visibility: 'public' | 'members' | 'restricted'
  accessBadge: 'free' | 'pro' | 'manual'
  estimatedDuration: string
  sortOrder: number
  featured?: boolean
  modules: {
    title: string
    description: string
    sortOrder: number
    lessons: {
      slug: string
      title: string
      summary: string
      sortOrder: number
      estimatedDuration: string
      previewLesson?: boolean
    }[]
  }[]
}

export type AccessGroupSeed = {
  slug: string
  name: string
  groupType: 'manual' | 'plan' | 'cohort' | 'migration'
  description: string
}

export type EmailTemplateSeed = {
  templateKey: string
  name: string
  purpose:
    | 'account_created'
    | 'password_changed'
    | 'payment_made'
    | 'subscription_started'
    | 'subscription_canceled'
    | 'payment_failed'
    | 'admin_notification'
  subject: string
  textBody: string
  adminCopyRequired?: boolean
}

export type SpaceSeed = {
  slug: string
  name: string
  spaceType: 'discussion' | 'course_cohort' | 'announcement' | 'chat'
  visibility: 'public' | 'members' | 'private' | 'secret'
  description: string
  sortOrder: number
  requiredAccessGroupSlugs?: string[]
  linkedCourseSlug?: string
}

export type AccessPolicySeed = {
  name: string
  resourceType: 'course' | 'space'
  resourceSlug: string
  privacy: 'public' | 'members' | 'private' | 'secret'
  requiredAccessGroupSlugs?: string[]
  requireActiveBilling: boolean
  allowPreviewLessons?: boolean
  priority: number
}

export const courseAccessGroupSeeds: AccessGroupSeed[] = [
  {
    slug: 'free-community',
    name: 'Free Community',
    groupType: 'plan',
    description: 'Members with free/community access only.',
  },
  {
    slug: 'pro-courses',
    name: 'Pro Courses',
    groupType: 'plan',
    description: 'Members with the Pro course subscription entitlement.',
  },
  {
    slug: 'private-clients',
    name: 'Private Clients',
    groupType: 'manual',
    description: 'Manually managed private client access.',
  },
]

export const courseSeeds: CourseSeed[] = [
  {
    slug: 'jpv-bootcamp-foundations',
    prototypeKey: 'seed:jpv-bootcamp-foundations',
    title: 'JPV Bootcamp Foundations',
    shortDescription: 'Foundational learning path for getting started with JPV Bootcamp.',
    visibility: 'members',
    accessBadge: 'free',
    estimatedDuration: '2 hours',
    sortOrder: 10,
    featured: true,
    modules: [
      {
        title: 'Start Here',
        description: 'Orientation and baseline expectations.',
        sortOrder: 10,
        lessons: [
          {
            slug: 'foundations-welcome',
            title: 'Welcome and How to Use the Bootcamp',
            summary: 'Introduces the course structure and learning rhythm.',
            sortOrder: 10,
            estimatedDuration: '8 min',
            previewLesson: true,
          },
          {
            slug: 'foundations-operating-principles',
            title: 'Operating Principles',
            summary: 'Defines the core principles students should apply throughout the course.',
            sortOrder: 20,
            estimatedDuration: '14 min',
          },
        ],
      },
    ],
  },
  {
    slug: 'pro-operator-lab',
    prototypeKey: 'seed:pro-operator-lab',
    title: 'Pro Operator Lab',
    shortDescription: 'Paid Pro course area used to validate entitlements and lock states.',
    visibility: 'restricted',
    accessBadge: 'pro',
    estimatedDuration: '5 hours',
    sortOrder: 20,
    modules: [
      {
        title: 'Systems and Delivery',
        description: 'Pro-level operating lessons.',
        sortOrder: 10,
        lessons: [
          {
            slug: 'pro-lab-preview',
            title: 'Pro Lab Preview',
            summary: 'Preview lesson visible before paid access.',
            sortOrder: 10,
            estimatedDuration: '7 min',
            previewLesson: true,
          },
          {
            slug: 'pro-lab-delivery-system',
            title: 'Build the Delivery System',
            summary: 'Private Pro lesson that requires an active entitlement.',
            sortOrder: 20,
            estimatedDuration: '22 min',
          },
        ],
      },
    ],
  },
  {
    slug: 'private-client-accelerator',
    prototypeKey: 'seed:private-client-accelerator',
    title: 'Private Client Accelerator',
    shortDescription: 'Private client course area for manual access validation.',
    visibility: 'restricted',
    accessBadge: 'manual',
    estimatedDuration: '6 hours',
    sortOrder: 30,
    modules: [
      {
        title: 'Private Client Track',
        description: 'Private delivery and implementation track.',
        sortOrder: 10,
        lessons: [
          {
            slug: 'private-accelerator-orientation',
            title: 'Private Accelerator Orientation',
            summary: 'Private client onboarding lesson.',
            sortOrder: 10,
            estimatedDuration: '12 min',
          },
        ],
      },
    ],
  },
]

export const emailTemplateSeeds: EmailTemplateSeed[] = [
  {
    templateKey: 'account-created',
    name: 'Account Created',
    purpose: 'account_created',
    subject: 'Your JPV Bootcamp account is ready',
    textBody:
      'Your JPV Bootcamp account has been created. Sign in with the email address used at checkout or by your administrator.',
    adminCopyRequired: true,
  },
  {
    templateKey: 'password-changed',
    name: 'Password Changed',
    purpose: 'password_changed',
    subject: 'Your JPV Bootcamp password was changed',
    textBody:
      'Your JPV Bootcamp password was changed. If this was not you, contact support immediately.',
  },
  {
    templateKey: 'payment-made',
    name: 'Payment Made',
    purpose: 'payment_made',
    subject: 'JPV Bootcamp payment received',
    textBody: 'We received your payment and updated your JPV Bootcamp access.',
    adminCopyRequired: true,
  },
  {
    templateKey: 'subscription-started',
    name: 'Subscription Started',
    purpose: 'subscription_started',
    subject: 'Your JPV Bootcamp subscription is active',
    textBody: 'Your subscription is active and your course access has been updated.',
    adminCopyRequired: true,
  },
  {
    templateKey: 'subscription-canceled',
    name: 'Subscription Canceled',
    purpose: 'subscription_canceled',
    subject: 'Your JPV Bootcamp subscription was canceled',
    textBody: 'Your subscription was canceled and paid/private access has been blocked.',
    adminCopyRequired: true,
  },
  {
    templateKey: 'payment-failed',
    name: 'Payment Failed',
    purpose: 'payment_failed',
    subject: 'JPV Bootcamp payment failed',
    textBody:
      'Your payment did not go through. Paid/private course and group access is blocked until billing is recovered.',
    adminCopyRequired: true,
  },
  {
    templateKey: 'admin-notification',
    name: 'Admin Notification',
    purpose: 'admin_notification',
    subject: 'JPV Bootcamp admin notification',
    textBody: 'An administrative JPV Bootcamp event requires review in JPV Bootcamp Portal.',
  },
]

export const spaceSeeds: SpaceSeed[] = [
  {
    slug: 'announcements',
    name: 'Announcements',
    spaceType: 'announcement',
    visibility: 'public',
    description: 'Public announcements visible to the community.',
    sortOrder: 10,
  },
  {
    slug: 'pro-community',
    name: 'Pro Community',
    spaceType: 'discussion',
    visibility: 'private',
    description: 'Private discussion space for Pro members.',
    sortOrder: 20,
    requiredAccessGroupSlugs: ['pro-courses'],
    linkedCourseSlug: 'pro-operator-lab',
  },
  {
    slug: 'private-client-room',
    name: 'Private Client Room',
    spaceType: 'chat',
    visibility: 'secret',
    description: 'Secret private client space.',
    sortOrder: 30,
    requiredAccessGroupSlugs: ['private-clients'],
    linkedCourseSlug: 'private-client-accelerator',
  },
]

export const accessPolicySeeds: AccessPolicySeed[] = [
  {
    name: 'Foundations member access',
    resourceType: 'course',
    resourceSlug: 'jpv-bootcamp-foundations',
    privacy: 'members',
    requireActiveBilling: false,
    allowPreviewLessons: true,
    priority: 10,
  },
  {
    name: 'Pro Operator Lab subscription access',
    resourceType: 'course',
    resourceSlug: 'pro-operator-lab',
    privacy: 'private',
    requiredAccessGroupSlugs: ['pro-courses'],
    requireActiveBilling: true,
    allowPreviewLessons: true,
    priority: 20,
  },
  {
    name: 'Private Accelerator manual access',
    resourceType: 'course',
    resourceSlug: 'private-client-accelerator',
    privacy: 'secret',
    requiredAccessGroupSlugs: ['private-clients'],
    requireActiveBilling: true,
    priority: 30,
  },
  {
    name: 'Announcements public access',
    resourceType: 'space',
    resourceSlug: 'announcements',
    privacy: 'public',
    requireActiveBilling: false,
    priority: 10,
  },
  {
    name: 'Pro Community private access',
    resourceType: 'space',
    resourceSlug: 'pro-community',
    privacy: 'private',
    requiredAccessGroupSlugs: ['pro-courses'],
    requireActiveBilling: true,
    priority: 20,
  },
  {
    name: 'Private Client Room secret access',
    resourceType: 'space',
    resourceSlug: 'private-client-room',
    privacy: 'secret',
    requiredAccessGroupSlugs: ['private-clients'],
    requireActiveBilling: true,
    priority: 30,
  },
]
