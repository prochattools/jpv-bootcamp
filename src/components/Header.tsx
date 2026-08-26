'use client'
import { Logo } from '@/components'
import EmailForm from '@/components/EmailForm'
import NavLinks from '@/components/nav-links'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import { Blog, Demo, OpenNav } from '@/icons'
import Link from 'next/link'

const nav_links = [
	{
		icon: <Demo />,
		title: 'Features',
		link: '#features',
	},
	{
		icon: <Blog width={18} height={18} />,
		title: 'FAQ',
		link: '#faq',
	},
]

const MobileNav = () => {
	return (
		<Sheet>
			<SheetTrigger aria-label='Open navigation menu'>
				<div className='text-black1' aria-hidden='true'>
					<OpenNav />
				</div>
			</SheetTrigger>
			<SheetContent className='bg-white px-0 pt-4 border-l-0 min-w-[320px]'>
				<SheetHeader>
					<SheetTitle className='text-black1 text-xl font-bold border-b border-[#b3b3b3] text-left pb-4 pl-4'>
						Menu
					</SheetTitle>
				</SheetHeader>
				<Link href='/' className='flex items-center gap-2 mt-8 mx-auto w-fit'>
					<Logo />
				</Link>
				<div className='my-8 mx-auto w-fit'>
					<NavLinks nav_links={nav_links} />
				</div>
				<div className='mb-8 mx-auto w-fit'>
					<EmailForm 
						source="header"
						placeholder="Get updates"
						buttonText="Subscribe"
						className="max-w-xs"
					/>
				</div>
			</SheetContent>
		</Sheet>
	)
}

const Header = () => {
	return (
		<div className='flex justify-center items-center w-full fixed top-0 z-50 bg-white'>
			<div className='max-w-[1440px] w-full flex justify-between items-center gap-4 px-4 sm:px-12 py-6'>
				<Link href='/'>
					<Logo />
				</Link>
				<div className='hidden lg:block'>
					<NavLinks nav_links={nav_links} />
				</div>

				<div className='hidden lg:flex items-center gap-4'>
					<EmailForm 
						source="header"
						placeholder="Get updates"
						buttonText="Subscribe"
						className="max-w-xs"
					/>
				</div>

				<div className='lg:hidden flex items-center gap-3'>
					<MobileNav />
				</div>
			</div>
		</div>
	)
}

export default Header
