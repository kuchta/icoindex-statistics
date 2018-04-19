declare module "*.json" {
	const content: any;
	export default content;
}

declare module "*.gql" {
	const content: string;
	export default content;
}
