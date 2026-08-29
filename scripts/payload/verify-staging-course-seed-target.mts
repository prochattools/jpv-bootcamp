import { assertStagingCourseSeedApplyTarget } from './staging-course-seed-boundary'

const target = assertStagingCourseSeedApplyTarget(process.env)
console.log(JSON.stringify(target))
