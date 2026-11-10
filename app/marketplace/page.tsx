// Keep the established /marketplace entry point, but render the same complete
// browse experience as /props. This prevents the navigation and older shared
// links from falling back to the former reduced category-only directory.
export { default, generateMetadata, revalidate } from "../props/page";
