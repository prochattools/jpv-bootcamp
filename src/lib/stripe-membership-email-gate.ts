export function shouldSendMembershipEmailForEvent(eventType: string): boolean {
	return eventType === 'customer.subscription.updated' || eventType === 'checkout.session.completed'
}
