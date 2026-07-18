const { withPayload } = require('@payloadcms/next/withPayload')

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	reactStrictMode: true,
	async redirects() {
		return [
			{
				// Bare /admin root redirects to the Payload login page so that
				// smoke tests and uptime monitors see a 308 rather than 200.
				// Payload renders its own login inside the admin SPA at /admin/login.
				source: '/admin',
				destination: '/admin/login',
				permanent: true,
			},
		]
	},
	images: {
		remotePatterns: [
			// NextJS <Image> component needs to whitelist domains for src={}
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
			},
			{
				protocol: 'https',
				hostname: 'pbs.twimg.com',
			},
			{
				protocol: 'https',
				hostname: 'images.unsplash.com',
			},
			{
				protocol: 'https',
				hostname: 'logos-world.net',
			},
			{
				protocol: 'http',
				hostname: 'localhost',
			},
			{
				protocol: 'https',
				hostname: 'localhost',
			},
			{
				protocol: 'https',
				hostname: 'cdn-icons-png.flaticon.com',
			},
			{
				protocol: 'https',
				hostname: 'res.cloudinary.com',
			},
			{
				protocol: 'https',
				hostname: 'blogger.googleusercontent.com',
			},
			{
				protocol: 'https',
				hostname: 'fast-strapi-cms-651b34b82e95.herokuapp.com',
			},
			{
				protocol: 'https',
				hostname: 'secure.gravatar.com',
			},
			{
				protocol: 'https',
				hostname: 'img.clerk.com',
			},
			{
				protocol: 'http',
				hostname: '3.73.130.136',
			},
			{
				protocol: 'https',
				hostname: '3.73.130.136',
			},
		],
	},
}

module.exports = withPayload(nextConfig)
