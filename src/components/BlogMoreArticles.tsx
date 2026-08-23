import Image from 'next/image'
import Link from 'next/link'

import { convertToReadableDate } from '@/utils/functions'

const BlogMoreArticles = ({ currentBlog, AllPosts }: any) => {
	const filteredPosts = AllPosts.filter(
		(post: any) => post.title.rendered !== currentBlog
	)
	return (
		<div className='max-w-6xl mx-auto p-6 mb-12'>
			<h2 className='text-4xl font-bold mb-6 text-center'>Other News</h2>
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 '>
				{filteredPosts.slice(0, 3).map((post: any, index: any) => (
					<Link
						href={`/blog/${post.slug}`}
						key={index}
						className='overflow-hidden rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card transition-all duration-500 ease-in-out hover:border-jpv-brand hover:shadow-jpv-card'
					>
						<Image
							src={post.featured_img}
							alt={post.title.rendered}
							className='object-cover'
							width={500}
							height={156}
						/>
						<div className='p-4'>
							<h2 className='mb-2 text-[16px] font-normal text-jpv-ink'>
								{post.title.rendered}
							</h2>
							<p className='text-jpv-muted'>
								{convertToReadableDate(post.date)}
							</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}

export default BlogMoreArticles
