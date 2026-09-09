const { withPayload } = require('@payloadcms/next/withPayload')

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	reactStrictMode: true,
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=31536000; includeSubDomains',
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'X-Frame-Options',
						value: 'SAMEORIGIN',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(self), microphone=(self), geolocation=()',
					},
				],
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
