import {auth} from '@clerk/nextjs/server';
import {redirect} from 'next/navigation';
import WorkMail from '@/components/work/WorkMail';
export const metadata={robots:{index:false,follow:false}};
export default async function WorkMailPage(){
 const {userId}=await auth();if(!userId)redirect('/sign-in?redirect_url=%2Fwork%2Fmail');
 return <WorkMail key={userId} accountId={userId}/>;
}
