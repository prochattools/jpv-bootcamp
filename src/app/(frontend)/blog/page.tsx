import config from '@/config'
import { getSEOTags } from '@/libs/seo'

export const metadata = getSEOTags({
	title: `${config.appName} Blog | Landing Page Best Practices`,
	description:
		'Learn how to build effective landing pages, collect emails, and grow your audience with modern web technologies',
	canonicalUrlRelative: '/blog',
})

export default async function Blog() {
	return (
		<div className='mt-[100px] mb-[40px]'>
			<div className='container mx-auto p-8 px-20 md:w-[80%]'>
				<div className='text-center max-w-xl mx-auto mt-14 mb-14'>
					<h1 className='text-4xl font-bold text-center mb-6'>
						The {config.appName} Blog
					</h1>

					<p className='text-lg opacity-80 leading-relaxed'>
						Learn how to build effective landing pages, collect emails, and grow your audience with modern web technologies.
					</p>
				</div>
				
				<div className='text-center py-12'>
					<p className='text-gray-600 dark:text-gray-400'>
						Blog posts coming soon! In the meantime, check out our landing page features.
					</p>
				</div>
			</div>
		</div>
	)
}
